import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ChatList } from 'src/app/features/chat/chat-list/chat-list';
import {TranslocoPipe} from '@ngneat/transloco';

@Component({
  selector: 'app-chat-layout',
  standalone: true,
  imports: [ChatList, RouterOutlet, TranslocoPipe],
  template: `
    <div class="chat-layout" [class.room-opened]="isRoomOpened()">
      <aside class="sidebar" [class.collapsed]="isCollapsed()" (dblclick)="onSidebarDblClick($event)">
        <app-chat-list></app-chat-list>
      </aside>

      <main class="main-content">
        @if (router.url === '/chat') {
          <div class="empty-chat-state">
            <i class="material-icons">forum</i>
            <p>{{ ('chat.selectChat') | transloco }}</p>
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
      border-right: 1px solid var(--border);
      background: var(--bg-card);
      display: flex;
      flex-direction: column;
      transition: width 0.25s ease, min-width 0.25s ease;
      user-select: none; /* Предотвращает случайное выделение текста при dblclick */
    }

    .main-content {
      flex: 1;
      height: 100%;
      position: relative;
      background: var(--bg-main);
    }

    .empty-chat-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-muted);
      i { font-size: 4rem; margin-bottom: 1rem; opacity: 0.5; }
      p { font-size: 1.1rem; margin: 0; }
    }

    /* ============================================================
       💻 ЭФФЕКТ СХЛОПЫВАНИЯ: По двойному клику ИЛИ на планшетах
       ============================================================ */
    .sidebar.collapsed {
      width: 76px !important;
      min-width: 76px !important;
    }
    @media (max-width: 1024px) and (min-width: 769px) {
      .sidebar {
        width: 76px !important;
        min-width: 76px !important;
      }

      ::ng-deep {
        app-chat-list {
          .search-block {
            padding: 0.75rem 0.5rem !important;

            input {
              display: none !important;
            }
            .search-wrapper {
              background: transparent !important;
              border: none !important;
              justify-content: center !important;
              padding: 0 !important;
              i { margin: 0 !important; font-size: 1.4rem; color: var(--text-muted); }
            }
          }

          .room-item {
            justify-content: center !important;
            padding: 0.8rem 0 !important;
            margin: 0.25rem 0.5rem !important;
            border-radius: 12px !important;
          }

          .room-avatar {
            margin: 0 !important;
          }

          .room-details {
            display: none !important;
          }
        }
      }
    }

    /* ============================================================
       📱 МОБИЛЬНЫЕ СТИЛИ
       ============================================================ */
    @media (max-width: 768px) {
      .sidebar {
        width: 100% !important;
        min-width: 100% !important;
        border-right: none;
      }

      .main-content {
        width: 100% !important;
        position: absolute;
        top: 0;
        left: 0;
        z-index: 10;
        height: 100%;
      }

      .chat-layout:not(.room-opened) {
        .sidebar { display: flex !important; }
        .main-content { display: none !important; }
      }

      .chat-layout.room-opened {
        .sidebar { display: none !important; }
        .main-content { display: block !important; }
      }
    }
  `]
})
export class ChatLayout {
  protected readonly router = inject(Router);
  // Signal to control the collapsed state of the chat list
  protected readonly isCollapsed = signal(false);

  isRoomOpened(): boolean {
    return this.router.url !== '/chat';
  }

  onSidebarDblClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Protection: if you click inside the search text field, do not collapse the panel
    if (target.tagName === 'INPUT') {
      return;
    }

    // Toggle the state
    this.isCollapsed.update(state => !state);
  }
}
