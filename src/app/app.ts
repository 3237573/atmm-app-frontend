import {Component, inject, OnInit, signal} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {GlobalCallOverlay} from '@features/chat/global-call-overlay/global-call-overlay';
import {ChatService} from '@core/services/chat.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlobalCallOverlay],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly chatService = inject(ChatService);
  protected readonly title = signal('atmm-app-frontend');

  ngOnInit(): void {
    // Automatically start a connection to SharedWorker at the start of the entire application
    this.chatService.connect();
  }
}
