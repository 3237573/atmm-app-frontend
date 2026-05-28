// chat-layout.component.ts
import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ChatList } from 'src/app/features/chat/chat-list/chat-list';

@Component({
  selector: 'app-chat-layout',
  standalone: true,
  imports: [ChatList, RouterOutlet],
  template: `
    <div class="chat-layout" [class.room-opened]="isRoomOpened()">
      <aside class="sidebar">
        <app-chat-list></app-chat-list>
      </aside>

      <main class="main-content">
        @if (router.url === '/chat') {
          <div class="empty-chat-state">
            <i class="material-icons">forum</i>
            <p>Выберите чат для начала общения</p>
          </div>
        }
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      max-height: 100%;
      overflow: hidden;
    }

    .chat-layout {
      display: flex;
      width: 100%;
      height: 100%;
      max-height: 100%;
      background: var(--bg-main);
    }

    .sidebar {
      width: 320px;
      min-width: 320px;
      height: 100%;
      background: var(--bg-elevated);
      transition: width 0.3s ease, min-width 0.3s ease;
    }

    .main-content {
      flex: 1;
      height: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;

      ::ng-deep app-chat-window {
        display: flex !important;
        flex-direction: column !important;
        flex: 1 !important;
        height: 100% !important;
        max-height: 100% !important;
        overflow: hidden !important;
      }
    }

    .empty-chat-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-muted);
      background: var(--bg-main);
      i { font-size: 4rem; margin-bottom: 1rem; opacity: 0.5; }
      p { font-size: 1.1rem; margin: 0; }
    }

    /* 💻 ЭТАП 1: Сужение списка (Подписи исчезают, логотипы остаются) */
    @media (max-width: 1024px) and (min-width: 769px) {
      .sidebar {
        width: 76px;
        min-width: 76px;
      }
    }

    /* 📱 ЭТАП 2: Мобильные устройства (Полный уход списка) */
    @media (max-width: 768px) {
      .sidebar {
        width: 100% !important;
        min-width: 100% !important;
        position: absolute;
        z-index: 2;
        height: 100%;
      }

      .main-content {
        width: 100% !important;
        position: absolute;
        z-index: 1;
        height: 100%;
      }

      /* Когда комната открыта, прячем сайдбар влево */
      .chat-layout.room-opened {
        .sidebar {
          transform: translateX(-100%);
        }
        .main-content {
          z-index: 3;
        }
      }
    }
  `]
})
export class ChatLayout {
  protected readonly router = inject(Router);

  isRoomOpened(): boolean {
    return this.router.url !== '/chat';
  }
}
