import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  message: string = '';
  loading: boolean = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.fetchMessage();
  }

  fetchMessage() {
    this.loading = true;
    this.http.get<{message: string}>('/api/hello')
      .subscribe({
        next: (response) => {
          this.message = response.message;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error fetching message:', error);
          this.message = 'Error connecting to backend';
          this.loading = false;
        }
      });
  }
}
