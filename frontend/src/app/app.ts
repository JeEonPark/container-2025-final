import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  isRecording = false;
  sttResults: string[] = [];
  
  // WebSocket 연결
  socket: Socket | null = null;
  connectionStatus = '연결 중...';
  
  // 마이크 설정
  microphones: MediaDeviceInfo[] = [];
  selectedMicId = '';
  
  // 오디오 스트리밍
  mediaRecorder: MediaRecorder | null = null;
  audioStream: MediaStream | null = null;
  recordingInterval: any = null;
  
  // Web Audio API
  audioContext: AudioContext | null = null;
  sourceNode: MediaStreamAudioSourceNode | null = null;
  processorNode: ScriptProcessorNode | null = null;
  
  // 실시간 상태
  chunksSet = 0;
  lastChunkTime = '';
  processingStatus = '';
  
  // 통계
  totalChunks = 0;
  totalSTTResults = 0;
  sessionStartTime = 0;

  title = 'Live Translator';
  currentTime = new Date();
  isConnected = false;
  messageCount = 0;
  lastMessage = '';
  messages: any[] = [];

  async ngOnInit() {
    this.connectSocket();
    await this.loadMicrophones();
    this.startTimeUpdate();
  }

  ngOnDestroy() {
    this.stopRecording();
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // WebSocket 연결
  connectSocket() {
    console.log('🔌 WebSocket 연결 시도...');
    this.connectionStatus = '연결 중...';
    
    const backendUrl = this.getBackendUrl();
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const socketUrl = `${protocol}//${backendUrl}`;
    
    console.log(`🔌 Socket.IO 연결 시도: ${socketUrl}`);
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });
    
    this.socket.on('connect', () => {
      console.log('✅ 서버 연결 성공');
      this.connectionStatus = '연결됨';
      console.log('🔍 현재 연결 상태:', this.connectionStatus);
      console.log('🔍 Socket 연결됨:', this.socket?.connected);
    });
    
    this.socket.on('connected', (data) => {
      console.log('🤝 서버 응답:', data.status);
      this.connectionStatus = '준비됨';
    });
    
    this.socket.on('stt_result', (data) => {
      this.totalSTTResults++;
      const processingInfo = data.processing_time ? 
        ` (처리: ${data.processing_time.toFixed(2)}초, 음성: ${data.audio_duration.toFixed(1)}초, 레벨: ${data.audio_level?.toFixed(0) || 'N/A'})` : '';
      
      console.log(`🎉 STT 결과 #${this.totalSTTResults}:`, data.text, processingInfo);
      
      const timestamp = new Date().toLocaleTimeString();
      const result = `[${timestamp}] [${data.language}] ${data.text}`;
      this.sttResults.push(result);
      
      this.processingStatus = `✅ STT 완료 #${this.totalSTTResults} (${data.audio_duration?.toFixed(1)}초)`;
      
      // 최대 15개 결과만 유지
      if (this.sttResults.length > 15) {
        this.sttResults.shift();
      }
    });
    
    this.socket.on('stt_error', (data) => {
      console.error('❌ STT 오류:', data.error);
      this.sttResults.push(`❌ [${new Date().toLocaleTimeString()}] 오류: ${data.error}`);
      this.processingStatus = '❌ STT 오류';
    });
    
    this.socket.on('recording_started', (data) => {
      console.log('🎤 서버 녹음 시작 확인:', data.status);
      this.processingStatus = '🎤 서버에서 녹음 시작됨';
    });
    
    this.socket.on('recording_stopped', (data) => {
      console.log('🛑 서버 녹음 중지 확인:', data.status);
      this.processingStatus = '🛑 서버에서 녹음 중지됨';
    });
    
    this.socket.on('disconnect', () => {
      console.log('❌ 서버 연결 해제');
      this.connectionStatus = '연결 끊김';
      this.processingStatus = '❌ 서버 연결 끊김';
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('🚫 연결 오류:', error);
      this.connectionStatus = '연결 실패';
      this.processingStatus = '🚫 연결 오류';
    });
  }

  // 마이크 목록 로드
  async loadMicrophones() {
    try {
      console.log('🎤 마이크 권한 요청 중...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log('📋 마이크 목록 로드 중...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.microphones = devices.filter(d => d.kind === 'audioinput');
      
      if (this.microphones.length > 0) {
        this.selectedMicId = this.microphones[0].deviceId;
        console.log(`✅ 기본 마이크 선택: ${this.getSelectedMicName()}`);
      }
      
      console.log(`🎤 사용가능한 마이크: ${this.microphones.length}개`);
      this.microphones.forEach((mic, i) => {
        console.log(`  ${i+1}. ${mic.label || `마이크 ${i+1}`}`);
      });
      
      console.log('🔍 버튼 활성화 조건 확인:');
      console.log('  - 마이크 선택됨:', !!this.selectedMicId);
      console.log('  - 연결 상태:', this.connectionStatus);
      console.log('  - Socket 연결됨:', this.socket?.connected);
    } catch (error) {
      console.error('❌ 마이크 권한 오류:', error);
      alert('마이크 권한을 허용해주세요!');
    }
  }

  // 실시간 녹음 시작 (Web Audio API 사용)
  async startRecording() {
    if (!this.socket || !this.selectedMicId) {
      alert('서버 연결 또는 마이크를 확인하세요!');
      return;
    }

    if (!this.socket.connected) {
      alert('서버에 연결되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      console.log('🚀 실시간 녹음 시작 (Web Audio API)');
      this.sessionStartTime = Date.now();
      this.totalChunks = 0;
      this.totalSTTResults = 0;
      
      // 선택된 마이크로 스트림 생성
      console.log(`🎤 마이크 스트림 생성: ${this.getSelectedMicName()}`);
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: this.selectedMicId },
          sampleRate: 16000,  // Whisper 요구사항
          channelCount: 1     // 모노
        }
      });

      console.log('🎵 Web Audio API 설정 중...');
      
      // AudioContext 생성
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      // 마이크 입력을 AudioContext에 연결
      this.sourceNode = this.audioContext.createMediaStreamSource(this.audioStream);
      
      // ScriptProcessorNode 생성 (4096 샘플 = 약 256ms @ 16kHz)
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

      // 오디오 데이터 처리
      this.processorNode.onaudioprocess = (event) => {
        if (!this.socket || !this.isRecording) return;

        const inputBuffer = event.inputBuffer.getChannelData(0);
        this.totalChunks++;
        this.lastChunkTime = new Date().toLocaleTimeString();

        // Float32Array를 Int16Array로 변환 (PCM 16-bit)
        const pcmData = new Int16Array(inputBuffer.length);
        for (let i = 0; i < inputBuffer.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputBuffer[i]));
          pcmData[i] = sample * 0x7FFF;
        }

        console.log(`📤 PCM chunk #${this.totalChunks} 전송: ${pcmData.length} samples (${pcmData.byteLength} bytes)`);

        // PCM 데이터를 base64로 인코딩해서 전송
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        this.socket.emit('audio_chunk', {
          audio: base64Audio,
          format: 'pcm16',  // PCM 16-bit 형식
          sampleRate: 16000,
          samples: pcmData.length
        });

        console.log(`✅ PCM chunk #${this.totalChunks} 전송 완료`);
        this.processingStatus = `📤 PCM chunk #${this.totalChunks} 전송됨`;
      };

      // 오디오 그래프 연결
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      // 서버에 녹음 시작 알림
      console.log('📡 서버에 녹음 시작 신호 전송...');
      this.socket.emit('start_recording');

      this.isRecording = true;
      console.log('✅ Web Audio API 스트리밍 활성화');
      this.processingStatus = '🎤 PCM 실시간 스트리밍 중';

    } catch (error) {
      console.error('❌ 녹음 시작 실패:', error);
      alert('녹음을 시작할 수 없습니다. 마이크를 확인해주세요.');
      this.isRecording = false;
      this.processingStatus = '❌ 녹음 시작 실패';
    }
  }

  // 녹음 중지
  stopRecording() {
    console.log('🛑 녹음 중지 시작');
    this.isRecording = false;

    // Web Audio API 정리
    if (this.processorNode) {
      console.log('⏹️ ProcessorNode 정리...');
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      console.log('⏹️ SourceNode 정리...');
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      console.log('⏹️ AudioContext 정리...');
      this.audioContext.close();
      this.audioContext = null;
    }

    // 기존 MediaRecorder 정리 (호환성)
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log('⏹️ MediaRecorder 중지...');
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.audioStream) {
      console.log('🔇 오디오 스트림 중지...');
      this.audioStream.getTracks().forEach(track => {
        track.stop();
        console.log('  - 트랙 중지:', track.label);
      });
      this.audioStream = null;
    }

    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    // 서버에 녹음 중지 알림
    if (this.socket) {
      console.log('📡 서버에 녹음 중지 신호 전송...');
      this.socket.emit('stop_recording');
    }
    
    const sessionDuration = (Date.now() - this.sessionStartTime) / 1000;
    console.log(`✅ 녹음 세션 완료: ${sessionDuration.toFixed(1)}초, ${this.totalChunks}개 PCM chunk, ${this.totalSTTResults}개 STT 결과`);
    this.processingStatus = `✅ 세션 완료: ${sessionDuration.toFixed(1)}초`;
  }

  // 결과 지우기
  clearResults() {
    console.log('🗑️ 결과 지우기');
    this.sttResults = [];
    this.totalSTTResults = 0;
    this.processingStatus = '🗑️ 결과 지워짐';
  }

  // 선택된 마이크 이름
  getSelectedMicName(): string {
    const selectedMic = this.microphones.find(mic => mic.deviceId === this.selectedMicId);
    return selectedMic?.label || `마이크 ${this.microphones.indexOf(selectedMic!) + 1}`;
  }

  // 세션 통계
  getSessionStats(): string {
    if (!this.isRecording) return '';
    const duration = (Date.now() - this.sessionStartTime) / 1000;
    const chunksPerSecond = this.totalChunks / duration;
    return `${duration.toFixed(0)}초, ${this.totalChunks}개 chunk (${chunksPerSecond.toFixed(1)}/초), ${this.totalSTTResults}개 결과`;
  }

  startTimeUpdate() {
    setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  // 환경별 백엔드 URL 설정
  private getBackendUrl(): string {
    // 도커 환경에서는 서비스 이름 사용, 로컬에서는 localhost 사용
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'localhost:5000';
    } else {
      // 도커 환경에서는 현재 호스트의 5000 포트 사용
      return `${hostname}:5000`;
    }
  }
}
