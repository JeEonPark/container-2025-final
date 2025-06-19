import { Component } from '@angular/core';
import { SimpleSTTComponent } from './simple-stt.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SimpleSTTComponent],
  template: `
    <app-simple-stt></app-simple-stt>
  `
})
export class AppComponent {
  title = 'Simple Whisper STT';
} 
