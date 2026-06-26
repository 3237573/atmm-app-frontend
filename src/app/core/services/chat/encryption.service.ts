import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { UploadKeysRequest } from '@core/models/chat.model';
import { firstValueFrom } from 'rxjs';
import { EncryptionStorageService } from '@core/services/chat/encryption.storage.service';

@Injectable({ providedIn: 'root' })
export class EncryptionService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(EncryptionStorageService);

  private deviceId: string | null = null;

  // Инициализация крипто-сессии устройства (вызывать при входе в систему / старте)
  async initDevice(): Promise<string> {
    // 1. Проверяем или генерируем уникальный Device ID в стиле Matrix
    let id = await this.storage.getMetadata('device_id');
    if (!id) {
      id = 'browser_' + crypto.randomUUID();
      await this.storage.setMetadata('device_id', id);
    }
    this.deviceId = id;

    // 2. Проверяем наличие Identity Key
    let identityKeyPrivate = await this.storage.getKey('identity_private');
    if (!identityKeyPrivate) {
      console.log(`[Olm E2EE] Первичный запуск устройства ${id}. Генерируем Identity Key Bundle...`);
      await this.generateAndUploadNewKeys(25);
    } else {
      // Опционально: можно проверить на сервере, нужны ли еще One-Time Keys, и догрузить их
      console.log(`[Olm E2EE] Устройство ${id} успешно инициализировано из локального хранилища.`);
    }

    return this.deviceId;
  }

  async getExistingDeviceId(): Promise<string> {
    if (!this.deviceId) {
      this.deviceId = await this.storage.getMetadata('device_id');
    }
    return this.deviceId || '';
  }

  // Генерация связки ключей и отправка на Ktor бэкенд (/keys/upload)
  private async generateAndUploadNewKeys(countOneTimeKeys = 25): Promise<void> {
    // Генерация долгосрочного Identity Key (ECDH P-256 как аналог X25519 в Olm)
    const identityKeyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    await this.storage.saveKey('identity_private', identityKeyPair.privateKey);

    const identityPublicJwk = await window.crypto.subtle.exportKey('jwk', identityKeyPair.publicKey);
    const identityKeyB64 = btoa(JSON.stringify(identityPublicJwk));

    // Генерация пула одноразовых ключей (One-Time Keys)
    const oneTimeKeysPublic: Record<string, string> = {};
    for (let i = 0; i < countOneTimeKeys; i++) {
      const keyId = 'otk_' + crypto.randomUUID();
      const otKeyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );

      await this.storage.saveKey(keyId, otKeyPair.privateKey);

      const otPublicJwk = await window.crypto.subtle.exportKey('jwk', otKeyPair.publicKey);
      oneTimeKeysPublic[keyId] = btoa(JSON.stringify(otPublicJwk));
    }

    // Соответствует твоей структуре UploadKeysRequest из chat.model.ts
    const payload: UploadKeysRequest = {
      deviceId: this.deviceId!,
      identityKey: identityKeyB64,
      oneTimeKeys: oneTimeKeysPublic
    };

    // Отправляем на бэкенд
    await firstValueFrom(this.http.post('/v1/chat/e2ee/keys/upload', payload));
    console.log(`[Olm E2EE] Ключи устройства успешно опубликованы на бэкенде Ktor.`);
  }

  // ШИФРОВАНИЕ ДЛЯ КОМНАТЫ (Аналог Outbound Olm Room Session)
  async encryptMessageForRoom(text: string, claimedKeys: Record<string, any>): Promise<{ content: string; metadata: Record<string, string> }> {
    // Генерируем случайный AES-GCM-256 ключ для текста сообщения
    const messageKey = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const globalIv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedContentBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: globalIv },
      messageKey,
      new TextEncoder().encode(text)
    );

    const mainContentCiphertext = this.bufferToBase64(encryptedContentBuffer);

    // Базовые метаданные Olm-сессии для комнаты
    const metadata: Record<string, string> = {
      iv: this.bufferToBase64(globalIv)
    };

    // Создаем временный эфемерный ключ отправки
    const ephemeralKeyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    const ephemeralPublicJwk = await window.crypto.subtle.exportKey('jwk', ephemeralKeyPair.publicKey);
    metadata['ephemeral_public'] = btoa(JSON.stringify(ephemeralPublicJwk));

    const rawMessageKeyBytes = await window.crypto.subtle.exportKey('raw', messageKey);

    // Упаковываем ключ сообщения для каждого участника (устройства) отдельно
    // Упаковываем ключ сообщения для каждого участника и для каждого его устройства отдельно
    for (const memberId of Object.keys(claimedKeys)) {
      const userDevices = claimedKeys[memberId]; // Теперь это массив устройств []
      if (!userDevices || !Array.isArray(userDevices)) continue;

      for (const device of userDevices) {
        // Если есть одноразовый ключ — шифруем на него, если нет — на долгосрочный Identity Key
        const recipientPublicB64 = device.oneTimeKey || device.identityKey;

        // 🌟 ИСПРАВЛЕНО: Если ключ одноразовый, берем его ID.
        // Если шифруем на identityKey, то ID для поиска в IndexedDB должен быть 'identity_private'
        const otkId = device.oneTimeKey ? device.oneTimeKeyId : 'identity_private';

        if (!recipientPublicB64 || !otkId) continue;

        const recipientJwk = JSON.parse(atob(recipientPublicB64));
        const recipientPublicKey = await window.crypto.subtle.importKey(
          'jwk', recipientJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []
        );

        // Вычисляем общий секрет Диффи-Хеллмана (ECDH)
        const wrappingKey = await window.crypto.subtle.deriveKey(
          { name: 'ECDH', public: recipientPublicKey },
          ephemeralKeyPair.privateKey,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );

        // Шифруем симметричный ключ сообщения ключом обертки
        const wrappingIv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: wrappingIv },
          wrappingKey,
          rawMessageKeyBytes
        );

        const encKeyB64 = this.bufferToBase64(encryptedKeyBuffer);
        const wrapIvB64 = this.bufferToBase64(wrappingIv);

        // Ключ в мапе связываем с конкретным уникальным deviceId браузера получателя
        metadata[`key_d_${device.deviceId}`] = `${otkId}:${wrapIvB64}:${encKeyB64}`;
      }
    }

    return {
      content: mainContentCiphertext,
      metadata
    };
  }

  // РАСШИФРОВКА СТАТИЧЕСКОГО OLM ФРЕЙМА
  async decryptMessageFromRoom(
    content: string, metadata: Record<string, string>, myDeviceId: string): Promise<string> {
    const userPayload = metadata[`key_d_${myDeviceId}`];
    if (!userPayload) throw new Error('No payload for this device');

    const ephemeralPublicB64 = metadata['ephemeral_public'];
    const globalIvB64 = metadata['iv'];

    if (!userPayload || !ephemeralPublicB64 || !globalIvB64) {
      throw new Error('Сообщение не адресовано вашему аккаунту / устройству');
    }

    const [otkId, wrapIvB64, encKeyB64] = userPayload.split(':');

    // Находим приватный ключ в IndexedDB
    let myPrivateKey = await this.storage.getKey(otkId);
    if (!myPrivateKey) {
      myPrivateKey = await this.storage.getKey('identity_private');
    }
    if (!myPrivateKey) throw new Error('Отсутствует локальный приватный ключ для дешифрации');

    const ephemJwk = JSON.parse(atob(ephemeralPublicB64));
    const senderEphemeralPublicKey = await window.crypto.subtle.importKey(
      'jwk', ephemJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []
    );

    // Восстанавливаем общий ключ обертки (ECDH)
    const wrappingKey = await window.crypto.subtle.deriveKey(
      { name: 'ECDH', public: senderEphemeralPublicKey },
      myPrivateKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // Достаем оригинальный ключ сообщения
    const decryptedKeyBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.base64ToBuffer(wrapIvB64) },
      wrappingKey,
      this.base64ToBuffer(encKeyB64)
    );

    const messageKey = await window.crypto.subtle.importKey(
      'raw', decryptedKeyBuffer, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );

    // Дешифруем сам текст
    const decryptedContentBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.base64ToBuffer(globalIvB64) },
      messageKey,
      this.base64ToBuffer(content)
    );

    // Удаляем использованный One-Time Key из IndexedDB для обеспечения Forward Secrecy
    // if (otkId && otkId !== 'identity') {
    //   void this.storage.deleteKey(otkId);
    // }

    return new TextDecoder().decode(decryptedContentBuffer);
  }

  private bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToBuffer(b64: string): ArrayBuffer {
    const binString = atob(b64);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
      bytes[i] = binString.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  }
}
