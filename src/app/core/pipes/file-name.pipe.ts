import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filename',
  standalone: true
})
export class FilenamePipe implements PipeTransform {
  transform(url: string | null | undefined): string {
    if (!url) return '';
    try {
      // 1. Cut off query parameters if they appear in the future (?token=...)
      const cleanUrl = url.split('?')[0];
      // 2. Taking the last part after the last slash
      const encodedName = cleanUrl.split('/').pop() || '';
      // 3. Decode back into a readable form (spaces, Cyrillic, etc.)
      return decodeURIComponent(encodedName);
    } catch (e) {
      return 'File'; // Фолбэк на случай непредвиденной ошибки в URL
    }
  }
}
