import {Component, inject, signal} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {ChatList} from 'src/app/features/chat/chat-list/chat-list';


@Component({
  selector: 'app-chat-layout',
  standalone: true,
  imports: [ChatList, RouterOutlet],
  template: `
    <div class="chat-layout">
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
    .chat-layout {
      display: flex;
      height: 100vh; /* Измени на 100%, если этот блок вложен в другой контейнер */
      width: 100%;
      background: var(--bg-main);
      overflow: hidden; /* Защита от лишних скроллов на уровне страницы */
    }

    .sidebar {
      width: 350px;
      min-width: 300px;
      border-right: 1px solid var(--border-subtle);
      height: 100%;
      background: var(--bg-elevated);
    }

    .main-content {
      flex: 1; /* Занимает все оставшееся место */
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .empty-chat-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-subtle);
      background: var(--bg-main);

      i {
        font-size: 4rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }
      p {
        font-size: 1.1rem;
        margin: 0;
      }
    }
  `]
})
export class ChatLayoutComponent {
  public router = inject(Router);
  currentRoomId = signal('')
}
