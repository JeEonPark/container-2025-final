import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-simple-stt',
  imports: [CommonModule, FormsModule],
  template: `
    <div style="text-align: center; padding: 2rem; max-width: 1000px; margin: 0 auto;">
      <h1>🎤 Real-time Whisper STT</h1>
      <p style="color: #666; margin-bottom: 2rem;">
        Real-time audio streaming + VAD + Whisper STT with WebSocket + Web Audio API
      </p>

      <!-- Connection Status -->
      <div style="margin-bottom: 2rem; padding: 1rem; border-radius: 8px; background-color: #f8f9fa;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <strong>🔌 WebSocket:</strong> 
            <span [style.color]="websocketStatus === 'connected' ? '#28a745' : '#dc3545'">
              {{ websocketStatus }}
            </span>
          </div>
          <div>
            <strong>🎤 Audio:</strong> 
            <span [style.color]="audioStatus === 'active' ? '#28a745' : '#dc3545'">
              {{ audioStatus }}
            </span>
          </div>
          <div>
            <strong>⚙️ Status:</strong> 
            <span [style.color]="currentStatus.includes('✅') ? '#28a745' : currentStatus.includes('❌') ? '#dc3545' : '#007bff'">
              {{ currentStatus }}
            </span>
          </div>
        </div>
        
        <!-- Session Statistics -->
        <div *ngIf="isStreaming" style="margin-top: 1rem; font-size: 14px; color: #666;">
          <strong>📊 Session:</strong> {{ getSessionStats() }}
        </div>
      </div>

      <!-- Microphone Selection -->
      <div style="margin-bottom: 2rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">
          🎤 Select Microphone:
        </label>
        <select 
          [(ngModel)]="selectedMicId" 
          [disabled]="isStreaming"
          style="padding: 8px; font-size: 14px; border-radius: 4px; border: 1px solid #ccc; min-width: 300px;">
          <option value="" disabled>Please select a microphone</option>
          <option *ngFor="let mic of microphones" [value]="mic.deviceId">
            {{ mic.label || 'Microphone ' + (microphones.indexOf(mic) + 1) }}
          </option>
        </select>
      </div>

      <!-- Translation Selection -->
      <div style="margin-bottom: 2rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">
          🌐 Select Target Language:
        </label>
        <select 
          [(ngModel)]="selectedTargetLanguage"
          (change)="onTargetLanguageChange()"
          [disabled]="isStreaming"
          style="padding: 8px; font-size: 14px; border-radius: 4px; border: 1px solid #ccc; min-width: 300px;">
          <option *ngFor="let lang of getLanguageOptions()" [value]="lang.code">
            {{ lang.name }}
          </option>
        </select>
      </div>

      <!-- Control Buttons -->
      <div style="margin-bottom: 2rem;">
        <button 
          (click)="isStreaming ? stopStreaming() : startStreaming()"
          [disabled]="!selectedMicId || websocketStatus !== 'connected'"
          style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; color: white; cursor: pointer; margin-right: 10px;"
          [style.background-color]="isStreaming ? '#dc3545' : '#28a745'"
          [style.opacity]="!selectedMicId || websocketStatus !== 'connected' ? '0.5' : '1'">
          {{ isStreaming ? '🛑 Stop Streaming' : '🎙 Start Audio Streaming' }}
        </button>

        <button 
          (click)="clearResults()"
          [disabled]="isStreaming"
          style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: 1px solid #ccc; background-color: #f8f9fa; color: #333; cursor: pointer;"
          [style.opacity]="isStreaming ? '0.5' : '1'">
          🗑️ Clear Results
        </button>
      </div>

      <!-- Real-time Status Display -->
      <div style="margin-bottom: 2rem;">
        <div *ngIf="isStreaming" style="padding: 1rem; border-radius: 8px; background-color: #d4edda; border: 1px solid #c3e6cb;">
          <div style="color: #155724; font-weight: bold; margin-bottom: 0.5rem;">
            🔴 Real-time audio streaming active... 
          </div>
          <div style="font-size: 12px; color: #155724;">
            • Real-time PCM capture via Web Audio API<br>
            • Send to server via WebSocket<br>
            • Automatic VAD + Whisper processing on server<br>
            • Total {{ totalSttResults }} results received
          </div>
        </div>
        
        <div *ngIf="!isStreaming" style="padding: 1rem; border-radius: 8px; background-color: #f8f9fa; border: 1px solid #dee2e6;">
          <div style="color: #6c757d; font-weight: bold; margin-bottom: 0.5rem;">
            💤 Waiting
          </div>
          <div style="font-size: 12px; color: #6c757d;">
            Start audio streaming to process speech in real-time
          </div>
        </div>
      </div>

      <!-- STT Results -->
      <div style="text-align: left;">
        <h3 style="text-align: center; margin-bottom: 1rem;">
          📝 Real-time STT Results ({{ totalSttResults }})
        </h3>
        <div style="border: 1px solid #ddd; border-radius: 8px; padding: 1rem; background-color: #f8f9fa; min-height: 300px; max-height: 600px; overflow-y: auto;">
          <div *ngIf="sttResults.length === 0" style="color: #999; text-align: center; padding: 2rem;">
            Start audio streaming and speak to see transcribed text here.<br>
            <small>Server's WebSocket + VAD + Whisper processes in real-time.</small>
          </div>
          
          <div *ngFor="let result of sttResults; let i = index" 
               style="margin-bottom: 15px; padding: 12px; border-radius: 6px; background-color: white; border-left: 4px solid #007bff;">
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 8px;">
              <div style="font-size: 12px; color: #666;">
                #{{ totalSttResults - i }} | {{ result.timestamp }}
              </div>
              <div style="font-size: 12px; color: #666;">
                [{{ result.language }}] {{ result.duration }}s | STT: {{ result.processingTime }}s | Translation: {{ result.translationTime }}s
              </div>
            </div>
            <div style="font-size: 16px; word-break: break-word; line-height: 1.4; margin-bottom: 8px;">
              <strong>Original:</strong> {{ result.text }}
            </div>
            <div *ngIf="result.translatedText" style="font-size: 16px; word-break: break-word; line-height: 1.4; color: #007bff;">
              <strong>Translation:</strong> {{ result.translatedText }}
            </div>
          </div>
        </div>
      </div>

      <!-- Technical Information -->
      <div style="margin-top: 2rem; font-size: 12px; color: #666; text-align: left;">
        <strong>📡 Technical Stack:</strong><br>
        • <strong>Client:</strong> Angular + Web Audio API (AudioContext)<br>
        • <strong>Server:</strong> Python + WebSocket + asyncio<br>
        • <strong>Audio Processing:</strong> Real-time VAD + Whisper<br>
        • <strong>Communication:</strong> WebSocket (PCM data + results)<br>
        • <strong>Features:</strong> Simple and stable without WebRTC
      </div>
    </div>
  `,
  standalone: true
})
export class SimpleSTTComponent implements OnInit, OnDestroy {
  // Status
  isStreaming = false;
  websocketStatus = 'disconnected';
  audioStatus = 'inactive';
  currentStatus = 'Waiting';
  
  // WebSocket
  websocket: WebSocket | null = null;
  
  // Web Audio API
  audioContext: AudioContext | null = null;
  mediaStream: MediaStream | null = null;
  audioWorkletNode: AudioWorkletNode | null = null;
  
  // Microphone
  microphones: MediaDeviceInfo[] = [];
  selectedMicId = '';
  
  // Translation
  supportedLanguages: {[key: string]: string} = {};
  selectedTargetLanguage = 'ko'; // Default to Korean
  
  // Results
  sttResults: any[] = [];
  totalSttResults = 0;
  sessionStartTime = 0;

  async ngOnInit() {
    await this.loadMicrophones();
    this.connectWebSocket();
  }

  ngOnDestroy() {
    this.stopStreaming();
    this.disconnectWebSocket();
  }

  // Load microphone list
  async loadMicrophones() {
    try {
      console.log('🎤 Requesting microphone permission...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.microphones = devices.filter(d => d.kind === 'audioinput');
      
      if (this.microphones.length > 0) {
        this.selectedMicId = this.microphones[0].deviceId;
        console.log(`✅ Default microphone selected: ${this.getSelectedMicName()}`);
      }
      
      console.log(`🎤 Available microphones: ${this.microphones.length}`);
    } catch (error) {
      console.error('❌ Microphone permission error:', error);
      alert('Please allow microphone permission!');
    }
  }

  // Connect WebSocket
  connectWebSocket() {
    console.log('🔌 Attempting WebSocket connection...');
    this.websocket = new WebSocket('ws://localhost:5000');
    
    this.websocket.onopen = () => {
      console.log('✅ WebSocket connected');
      this.websocketStatus = 'connected';
      this.currentStatus = '✅ WebSocket connected';
      
      // Request supported languages
      this.requestSupportedLanguages();
    };
    
    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message:', data);
        
        if (data.type === 'stt_result') {
          this.totalSttResults++;
          const timestamp = new Date(data.timestamp * 1000).toLocaleTimeString();
          
          this.sttResults.unshift({
            text: data.text,
            translatedText: data.translated_text || '',
            language: data.language,
            timestamp: timestamp,
            duration: data.audio_duration?.toFixed(1) || '?',
            processingTime: data.processing_time?.toFixed(2) || '?',
            translationTime: data.translation_time?.toFixed(2) || '0',
            audioLevel: data.audio_level?.toFixed(0) || '?'
          });
          
          // Keep maximum 20 results (newest at top, so remove from bottom)
          if (this.sttResults.length > 20) {
            this.sttResults.pop();
          }
          
          this.currentStatus = `✅ STT completed #${this.totalSttResults}`;
          console.log(`🎉 STT result #${this.totalSttResults}: ${data.text}`);
          if (data.translated_text) {
            console.log(`🌐 Translation result: ${data.translated_text}`);
          }
          
        } else if (data.type === 'status') {
          this.currentStatus = data.message;
          console.log(`📢 Status: ${data.message}`);
          
        } else if (data.type === 'connected') {
          console.log('🤝 WebSocket connection confirmed');
          
        } else if (data.type === 'supported_languages') {
          this.supportedLanguages = data.languages;
          console.log('🌐 Supported languages:', this.supportedLanguages);
          
          // Set default language if not already set
          if (!this.selectedTargetLanguage && this.supportedLanguages['ko']) {
            this.selectedTargetLanguage = 'ko';
          }
        }
      } catch (error) {
        console.error('❌ WebSocket message parsing error:', error);
      }
    };
    
    this.websocket.onclose = () => {
      console.log('❌ WebSocket connection closed');
      this.websocketStatus = 'disconnected';
      this.currentStatus = '❌ WebSocket disconnected';
    };
    
    this.websocket.onerror = (error) => {
      console.error('🚫 WebSocket error:', error);
      this.websocketStatus = 'error';
      this.currentStatus = '🚫 WebSocket error';
    };
  }

  // Disconnect WebSocket
  disconnectWebSocket() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  // Start audio streaming
  async startStreaming() {
    if (!this.selectedMicId || this.websocketStatus !== 'connected') {
      alert('Please select a microphone and check WebSocket connection!');
      return;
    }

    try {
      console.log('🚀 Starting audio streaming');
      this.sessionStartTime = Date.now();
      this.currentStatus = '🔄 Setting up audio...';
      
      // Create AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      
      // Create microphone stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: this.selectedMicId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1
        }
      });
      
      console.log('🎤 Microphone stream created');
      
      // Create MediaStreamSource
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Create ScriptProcessorNode (4096 samples = ~256ms @ 16kHz)
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
        }
        
        // Encode to Base64 and send via WebSocket
        const pcmBytes = new Uint8Array(pcmData.buffer);
        const base64Data = btoa(String.fromCharCode(...pcmBytes));
        
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify({
            type: 'audio',
            data: base64Data
          }));
        }
        
        // Show audio level
        const maxLevel = Math.max(...Array.from(pcmData).map(x => Math.abs(x)));
        if (maxLevel > 1000) {  // Log only above threshold
          console.log(`🎵 Audio sent: ${pcmData.length} samples, max: ${maxLevel}`);
        }
      };
      
      // Connect audio graph
      source.connect(processor);
      processor.connect(this.audioContext.destination);
      
      // Send streaming start signal
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({ type: 'start' }));
      }
      
      this.isStreaming = true;
      this.audioStatus = 'active';
      this.currentStatus = '🎤 Audio streaming active';
      
      console.log('✅ Audio streaming started');
      
    } catch (error) {
      console.error('❌ Failed to start audio streaming:', error);
      this.currentStatus = '❌ Audio start failed';
      this.audioStatus = 'error';
      alert(`Audio streaming failed: ${error}`);
      this.stopStreaming();
    }
  }

  // Stop streaming
  stopStreaming() {
    console.log('🛑 Stopping audio streaming');
    
    // Send streaming stop signal
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: 'stop' }));
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log('⏹️ Track stopped');
      });
      this.mediaStream = null;
    }
    
    this.isStreaming = false;
    this.audioStatus = 'inactive';
    
    const sessionDuration = (Date.now() - this.sessionStartTime) / 1000;
    console.log(`✅ Session completed: ${sessionDuration.toFixed(1)}s, ${this.totalSttResults} STT results`);
    this.currentStatus = `✅ Session completed: ${sessionDuration.toFixed(1)}s`;
  }

  // Clear results
  clearResults() {
    console.log('🗑️ Clearing results');
    this.sttResults = [];
    this.totalSttResults = 0;
    this.currentStatus = '🗑️ Results cleared';
  }

  // Get selected microphone name
  getSelectedMicName(): string {
    const selectedMic = this.microphones.find(mic => mic.deviceId === this.selectedMicId);
    return selectedMic?.label || `Microphone ${this.microphones.indexOf(selectedMic!) + 1}`;
  }

  // Get session statistics
  getSessionStats(): string {
    if (!this.isStreaming) return '';
    const duration = (Date.now() - this.sessionStartTime) / 1000;
    return `${duration.toFixed(0)}s streaming, ${this.totalSttResults} STT results`;
  }

  // 언어 옵션 가져오기
  getLanguageOptions(): { code: string; name: string }[] {
    return Object.entries(this.supportedLanguages).map(([code, name]) => ({
      code,
      name
    }));
  }

  // Handle language change
  onTargetLanguageChange() {
    console.log('🌐 Language changed:', this.selectedTargetLanguage);
    
    // Send target language to server
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'set_target_language',
        language: this.selectedTargetLanguage
      }));
      console.log(`🌐 Target language sent to server: ${this.selectedTargetLanguage}`);
    }
  }

  // Request supported languages
  requestSupportedLanguages() {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: 'get_supported_languages' }));
    }
  }
} 

