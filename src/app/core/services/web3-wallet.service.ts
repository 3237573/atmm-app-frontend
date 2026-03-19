// src/app/core/services/web3-wallet.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WalletInfo } from '../models';

declare global {
  interface Window {
    ethereum?: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class Web3WalletService {
  private readonly walletSubject = new BehaviorSubject<WalletInfo>({
    address: '',
    chainId: 0,
    balance: '0',
    isConnected: false
  });

  wallet$ = this.walletSubject.asObservable();

  /**
   * Проверка наличия MetaMask
   */
  private checkMetaMask(): boolean {
    return typeof window !== 'undefined' && !!window.ethereum;
  }

  /**
   * Подключение кошелька
   */
  async connect(): Promise<string> {
    if (!this.checkMetaMask()) {
      throw new Error('MetaMask not installed. Please install MetaMask extension.');
    }

    try {
      // Запрос на подключение
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];

      // Обновляем информацию о кошельке
      await this.updateWalletInfo(address);

      // Подписываемся на события
      this.setupListeners();

      return address;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('Connection rejected by user');
      }
      throw new Error(`Connection failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Отключение кошелька
   */
  disconnect(): void {
    this.walletSubject.next({
      address: '',
      chainId: 0,
      balance: '0',
      isConnected: false
    });
  }

  /**
   * Настройка слушателей событий MetaMask
   */
  private setupListeners(): void {
    if (!window.ethereum) return;

    // Смена аккаунта
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        this.updateWalletInfo(accounts[0]);
      }
    });

    // Смена сети
    window.ethereum.on('chainChanged', (chainId: string) => {
      // Обновляем информацию с новым chainId
      const current = this.walletSubject.value;
      this.walletSubject.next({
        ...current,
        chainId: parseInt(chainId, 16)
      });
    });

    // Отключение
    window.ethereum.on('disconnect', () => {
      this.disconnect();
    });
  }

  /**
   * Обновление информации о кошельке
   */
  private async updateWalletInfo(address: string): Promise<void> {
    try {
      const [chainId, balance] = await Promise.all([
        window.ethereum.request({ method: 'eth_chainId' }),
        window.ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest']
        })
      ]);

      this.walletSubject.next({
        address,
        chainId: parseInt(chainId, 16),
        balance: parseInt(balance, 16).toString(),
        isConnected: true
      });
    } catch (error) {
      console.error('Error updating wallet info:', error);
      throw error;
    }
  }

  /**
   * Получение информации о кошельке
   */
  getWalletInfo(): Observable<WalletInfo> {
    return this.wallet$;
  }

  /**
   * Проверка подключения
   */
  isConnected(): boolean {
    return this.walletSubject.value.isConnected;
  }

  /**
   * Отправка транзакции
   */
  async sendTransaction(
    to: string,
    data: string,
    value: string = '0x0'
  ): Promise<string> {
    if (!this.checkMetaMask()) {
      throw new Error('MetaMask not installed');
    }

    const from = this.walletSubject.value.address;
    if (!from) {
      throw new Error('Wallet not connected');
    }

    try {
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from,
          to,
          data,
          value
        }]
      });

      return txHash;
    } catch (error: any) {
      throw new Error(`Transaction failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Подпись сообщения
   */
  async signMessage(message: string): Promise<string> {
    if (!this.checkMetaMask()) {
      throw new Error('MetaMask not installed');
    }

    const from = this.walletSubject.value.address;
    if (!from) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, from]
      });

      return signature;
    } catch (error: any) {
      throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Получение текущего chainId
   */
  getChainId(): number {
    return this.walletSubject.value.chainId;
  }

  /**
   * Получение адреса
   */
  getAddress(): string {
    return this.walletSubject.value.address;
  }

  /**
   * Получение баланса
   */
  getBalance(): string {
    return this.walletSubject.value.balance;
  }

  /**
   * Форматирование баланса в ETH
   */
  getBalanceInEth(): number {
    const balanceWei = parseInt(this.walletSubject.value.balance);
    return balanceWei / 1e18;
  }

  /**
   * Проверка наличия достаточного баланса
   */
  hasEnoughBalance(requiredEth: number): boolean {
    return this.getBalanceInEth() >= requiredEth;
  }

  /**
   * Добавление сети в MetaMask
   */
  async addNetwork(
    networkName: string,
    rpcUrl: string,
    chainId: number,
    symbol: string,
    explorerUrl?: string
  ): Promise<boolean> {
    if (!this.checkMetaMask()) {
      throw new Error('MetaMask not installed');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${chainId.toString(16)}`,
          chainName: networkName,
          nativeCurrency: {
            name: symbol,
            symbol: symbol,
            decimals: 18
          },
          rpcUrls: [rpcUrl],
          blockExplorerUrls: explorerUrl ? [explorerUrl] : []
        }]
      });
      return true;
    } catch (error: any) {
      console.error('Error adding network:', error);
      return false;
    }
  }

  /**
   * Переключение сети
   */
  async switchNetwork(chainId: number): Promise<boolean> {
    if (!this.checkMetaMask()) {
      throw new Error('MetaMask not installed');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }]
      });
      return true;
    } catch (error: any) {
      console.error('Error switching network:', error);
      return false;
    }
  }

  /**
   * Очистка слушателей
   */
  removeListeners(): void {
    if (!window.ethereum) return;

    window.ethereum.removeAllListeners('accountsChanged');
    window.ethereum.removeAllListeners('chainChanged');
    window.ethereum.removeAllListeners('disconnect');
  }
}
