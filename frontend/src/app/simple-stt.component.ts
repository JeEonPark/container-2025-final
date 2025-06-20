import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-simple-stt',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-screen bg-gray-50 flex flex-col">
      <!-- Header -->
      <div class="bg-white border-b border-gray-200 flex-shrink-0">
        <div class="w-full px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-bold text-gray-900">
                Voice Translator
              </h1>
              <p class="text-base text-gray-500 mt-1">Real-time speech-to-text with instant translation</p>
            </div>
            <div class="flex items-center space-x-6">
              <!-- Status Indicators -->
              <div class="flex items-center space-x-2">
                <div class="w-3 h-3 rounded-full" 
                     [class]="websocketStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'"></div>
                <span class="text-sm text-gray-600 font-medium">Connection</span>
              </div>
              <div class="flex items-center space-x-2">
                <div class="w-3 h-3 rounded-full" 
                     [class]="audioStatus === 'active' ? 'bg-blue-500' : 'bg-gray-400'"></div>
                <span class="text-sm text-gray-600 font-medium">Microphone</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 flex flex-col w-full px-6 py-4">
        <!-- Control Panel -->
        <div class="bg-white rounded-lg border border-gray-200 mb-4 flex-shrink-0">
          <div class="p-4">
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
              <!-- Microphone Selection -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Microphone Device
                </label>
                <select 
                  [(ngModel)]="selectedMicId" 
                  [disabled]="isStreaming"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500">
                  <option value="" disabled>Select microphone</option>
                  <option *ngFor="let mic of microphones" [value]="mic.deviceId">
                    {{ mic.label || 'Microphone ' + (microphones.indexOf(mic) + 1) }}
                  </option>
                </select>
              </div>

              <!-- Language Selection -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Translate to
                </label>
                <select 
                  [(ngModel)]="selectedTargetLanguage"
                  (ngModelChange)="onTargetLanguageChange()"
                  [disabled]="isStreaming"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500">
                  <option *ngFor="let lang of getLanguageOptions()" [value]="lang.code">
                    {{ lang.name }}
                  </option>
                </select>
              </div>

              <!-- Control Buttons -->
              <div class="flex space-x-3">
                <button 
                  (click)="isStreaming ? stopStreaming() : startStreaming()"
                  [disabled]="!selectedMicId || websocketStatus !== 'connected'"
                  class="flex items-center space-x-2 px-6 py-2 rounded-lg font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  [class]="isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'">
                  <span class="font-bold">{{ isStreaming ? 'Stop' : 'Start' }}</span>
                </button>

                <button 
                  (click)="clearResults()"
                  [disabled]="isStreaming"
                  class="px-4 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                  <span class="font-bold">CLEAR</span>
                </button>
              </div>

              <!-- Status & Stats -->
              <div class="text-right">
                <div class="text-sm font-medium mb-1"
                     [class]="getStatusClass()">
                  {{ currentStatus }}
                </div>
                <div *ngIf="isStreaming" class="text-xs text-gray-500">
                  {{ getSessionStats() }}
                </div>
                <div *ngIf="!isStreaming && totalSttResults > 0" class="text-xs text-gray-500">
                  {{ totalSttResults }} translations completed
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Translation Results Container -->
        <div class="bg-white rounded-lg border border-gray-200 flex-1 flex flex-col" style="max-height: calc(100vh - 280px);">
          <!-- Results Header -->
          <div class="border-b border-gray-200 px-4 py-3 flex-shrink-0">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900">
                Translation History
              </h3>
              <div class="flex items-center space-x-2">
                <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                  {{ totalSttResults }} results
                </span>
                <div *ngIf="isStreaming" class="flex items-center space-x-2 bg-blue-50 rounded px-2 py-1">
                  <div class="flex space-x-1">
                    <div class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                    <div class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                    <div class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                  </div>
                  <span class="text-blue-700 text-xs font-medium">Processing...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Results Area -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4" #messagesContainer>
            <!-- Empty State -->
            <div *ngIf="sttResults.length === 0" class="flex flex-col items-center justify-center h-full text-gray-500">
              <div class="text-2xl mb-2 font-bold text-gray-300">TRANSLATE</div>
              <p class="text-base font-medium text-gray-700">Ready to translate</p>
              <p class="text-sm text-center mt-1">Start recording to see real-time translation results</p>
            </div>

            <!-- Chat Messages -->
            <div *ngFor="let result of sttResults.slice().reverse(); let i = index" class="animate-fade-in mb-4">
              <!-- Single Message Bubble -->
              <div class="flex justify-end">
                <div class="max-w-3xl">
                  <!-- Message Header -->
                  <div class="flex items-center justify-end space-x-2 mb-1">
                    <span class="text-xs text-gray-500">{{ result.timestamp }}</span>
                    <span class="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">
                      #{{ sttResults.length - i }}
                    </span>
                    <div class="flex items-center space-x-1 text-xs text-gray-500">
                      <span>{{ result.duration }}s</span>
                      <span>•</span>
                      <span>{{ result.processingTime }}s</span>
                      <span *ngIf="result.translatedText">• {{ result.translationTime }}s</span>
                    </div>
                  </div>
                  
                  <!-- Message Bubble -->
                  <div class="bg-blue-500 text-white rounded-lg px-6 py-5 rounded-br-sm shadow-lg">
                    <!-- Original Text -->
                    <div class="mb-4">
                      <div class="flex items-center mb-2">
                        <span class="text-sm opacity-80 font-semibold bg-blue-600 bg-opacity-50 px-2 py-1 rounded text-xs">{{ result.language.toUpperCase() }}</span>
                      </div>
                      <p class="text-lg opacity-95 leading-relaxed font-normal">{{ result.text }}</p>
                    </div>
                    
                    <!-- Divider -->
                    <div class="border-t-2 border-blue-300 border-opacity-40 my-4"></div>
                    
                    <!-- Translation -->
                    <div *ngIf="result.translatedText">
                      <div class="flex items-center mb-3">
                        <span class="text-sm opacity-80 font-semibold bg-blue-600 bg-opacity-50 px-2 py-1 rounded text-xs">{{ selectedTargetLanguage.toUpperCase() }}</span>
                      </div>
                      <p class="text-2xl font-semibold leading-relaxed">{{ result.translatedText }}</p>
                    </div>

                    <!-- No Translation Message -->
                    <div *ngIf="!result.translatedText">
                      <p class="text-lg italic opacity-80 text-center">Translation not available</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  `,
  standalone: true
})
export class SimpleSTTComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  // Status
  isStreaming = false;
  websocketStatus = 'disconnected';
  audioStatus = 'inactive';
  currentStatus = 'Ready to connect';
  
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
  
  // Auto scroll
  private shouldScrollToBottom = false;

  // Environment-based backend URL
  private getBackendUrl(): string {
    // Use service name in Docker environment, localhost for local
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'localhost:5000';
    } else {
      // Use current host's 5000 port in Docker environment
      return `${hostname}:5000`;
    }
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendUrl = this.getBackendUrl();
    return `${protocol}//${backendUrl}/ws`;
  }

  async ngOnInit() {
    await this.loadMicrophones();
    this.connectWebSocket();
  }

  ngOnDestroy() {
    this.stopStreaming();
    this.disconnectWebSocket();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  // Load microphone list
  async loadMicrophones() {
    try {
      console.log('Requesting microphone permission...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.microphones = devices.filter(d => d.kind === 'audioinput');
      
      if (this.microphones.length > 0) {
        this.selectedMicId = this.microphones[0].deviceId;
        console.log(`Default microphone selected: ${this.getSelectedMicName()}`);
      }
      
      console.log(`Available microphones: ${this.microphones.length}`);
    } catch (error) {
      console.error('Microphone permission error:', error);
      alert('Please allow microphone permission!');
    }
  }

  // Connect WebSocket
  connectWebSocket() {
    console.log('Connecting to WebSocket...');
    const wsUrl = this.getWebSocketUrl();
    console.log(`WebSocket URL: ${wsUrl}`);
    this.websocket = new WebSocket(wsUrl);
    
    this.websocket.onopen = () => {
      console.log('WebSocket connected');
      this.websocketStatus = 'connected';
      this.currentStatus = 'Connected';
      
      // Request supported languages
      this.requestSupportedLanguages();
      
      // Send initial language setting
      this.onTargetLanguageChange();
    };
    
    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);
        
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
          
          // Keep maximum 50 results for lecture hall display
          if (this.sttResults.length > 50) {
            this.sttResults.pop();
          }
          
          // Trigger auto scroll to bottom
          this.shouldScrollToBottom = true;
          
          this.currentStatus = `Translation #${this.totalSttResults} completed`;
          console.log(`STT result #${this.totalSttResults}: ${data.text}`);
          if (data.translated_text) {
            console.log(`Translation result: ${data.translated_text}`);
          }
          
        } else if (data.type === 'status') {
          this.currentStatus = data.message;
          console.log(`Status: ${data.message}`);
          
        } else if (data.type === 'connected') {
          console.log('WebSocket connection confirmed');
          
        } else if (data.type === 'supported_languages') {
          this.supportedLanguages = data.languages;
          console.log('Supported languages:', this.supportedLanguages);
          
          // Set default language if not already set
          if (!this.selectedTargetLanguage && this.supportedLanguages['ko']) {
            this.selectedTargetLanguage = 'ko';
          }
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };
    
    this.websocket.onclose = () => {
      console.log('WebSocket connection closed');
      this.websocketStatus = 'disconnected';
      this.currentStatus = 'Disconnected';
    };
    
    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.websocketStatus = 'error';
      this.currentStatus = 'Connection error';
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
      console.log('Starting audio streaming');
      this.sessionStartTime = Date.now();
      this.currentStatus = 'Setting up audio...';
      
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
      
      console.log('Microphone stream created');
      
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
          console.log(`Audio sent: ${pcmData.length} samples, max: ${maxLevel}`);
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
      this.currentStatus = 'Recording & translating...';
      
      console.log('Audio streaming started');
      
    } catch (error) {
      console.error('Failed to start audio streaming:', error);
      this.currentStatus = 'Recording failed';
      this.audioStatus = 'error';
      alert(`Audio streaming failed: ${error}`);
      this.stopStreaming();
    }
  }

  // Stop streaming
  stopStreaming() {
    console.log('Stopping audio streaming');
    
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
        console.log('Track stopped');
      });
      this.mediaStream = null;
    }
    
    this.isStreaming = false;
    this.audioStatus = 'inactive';
    
    const sessionDuration = (Date.now() - this.sessionStartTime) / 1000;
    console.log(`Session completed: ${sessionDuration.toFixed(1)}s, ${this.totalSttResults} STT results`);
    this.currentStatus = `Session completed`;
  }

  // Clear results
  clearResults() {
    console.log('Clearing results');
    this.sttResults = [];
    this.totalSttResults = 0;
    this.currentStatus = 'History cleared';
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
    return `${duration.toFixed(0)}s • ${this.totalSttResults} translations`;
  }

  // Get language options
  getLanguageOptions(): { code: string; name: string }[] {
    return Object.entries(this.supportedLanguages).map(([code, name]) => ({
      code,
      name
    }));
  }

  // Handle language change
  onTargetLanguageChange() {
    console.log('Language changed:', this.selectedTargetLanguage);
    
    // Send target language to server
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'set_target_language',
        language: this.selectedTargetLanguage
      }));
      console.log(`Target language sent to server: ${this.selectedTargetLanguage}`);
    }
  }

  // Request supported languages
  requestSupportedLanguages() {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: 'get_supported_languages' }));
    }
  }

  // Get status class for styling
  getStatusClass(): string {
    if (this.currentStatus.includes('completed') || this.currentStatus.includes('Connected')) return 'text-green-600';
    if (this.currentStatus.includes('failed') || this.currentStatus.includes('error') || this.currentStatus.includes('Disconnected')) return 'text-red-600';
    if (this.currentStatus.includes('Recording') || this.currentStatus.includes('Setting up')) return 'text-blue-600';
    return 'text-gray-600';
  }

  // Auto scroll to bottom
  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      console.error('Auto scroll error:', err);
    }
  }
} 

