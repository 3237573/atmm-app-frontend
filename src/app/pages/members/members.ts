import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MemberService } from '../../core/services/member.service';
import { MemberResponse } from '../../core/models/member.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './members.html',
  styleUrl: './members.scss'
})
export class Members implements OnInit {
  members: MemberResponse[] = [];
  loading = true;

  constructor(
    private readonly memberService: MemberService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.memberService.getMembers().subscribe({
      next: (data) => {
        this.members = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Ошибка загрузки сотрудников', err);
        this.loading = false;
      }
    });
  }

  viewActivity(userId: string) {
    // Переход на страницу трекера с ID пользователя
    this.router.navigate(['/tracker'], { queryParams: { userId: userId } });
  }
}
