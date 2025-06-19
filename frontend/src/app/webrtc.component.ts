import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-webrtc-stt',
  imports: [CommonModule, FormsModule],
  template: `
    <div style="text-align: center; padding: 2rem; max-width: 1000px; margin: 0 auto;">
      <h1>🎤 WebRTC + Whisper STT (Real-time)</h1>
      <p style="color: #666; margin-bottom: 2rem;">
        aiortc 서버와 WebRTC로 실시간 오디오 스트리밍 + VAD + Whisper STT
      </p>

      <!-- 연결 상태 -->
      <div style="margin-bottom: 2rem; padding: 1rem; border-radius: 8px; background-color: #f8f9fa;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <strong>🔗 WebRTC 상태:</strong> 
            <span [style.color]="webrtcStatus === 'connected' ? '#28a745' : webrtcStatus === 'failed' ? '#dc3545' : '#ffc107'">
              {{ webrtcStatus }}
            </span>
          </div>
          <div>
            <strong>🔌 WebSocket:</strong> 
            <span [style.color]="websocketStatus === 'connected' ? '#28a745' : '#dc3545'">
              {{ websocketStatus }}
            </span>
          </div>
          <div>
            <strong>⚙️ 상태:</strong> 
            <span [style.color]="currentStatus.includes('✅') ? '#28a745' : currentStatus.includes('❌') ? '#dc3545' : '#007bff'">
              {{ currentStatus }}
            </span>
          </div>
        </div>
        
        <!-- 세션 통계 -->
        <div *ngIf="isStreaming" style="margin-top: 1rem; font-size: 14px; color: #666;">
          <strong>📊 세션:</strong> {{ getSessionStats() }}
        </div>
      </div>

      <!-- 마이크 선택 -->
      <div style="margin-bottom: 2rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">
          🎤 마이크 선택:
        </label>
        <select 
          [(ngModel)]="selectedMicId" 
          [disabled]="isStreaming"
          style="padding: 8px; font-size: 14px; border-radius: 4px; border: 1px solid #ccc; min-width: 300px;">
          <option value="" disabled>마이크를 선택하세요</option>
          <option *ngFor="let mic of microphones" [value]="mic.deviceId">
            {{ mic.label || '마이크 ' + (microphones.indexOf(mic) + 1) }}
          </option>
        </select>
      </div>

      <!-- 제어 버튼 -->
      <div style="margin-bottom: 2rem;">
        <button 
          (click)="isStreaming ? stopStreaming() : startStreaming()"
          [disabled]="!selectedMicId || websocketStatus !== 'connected'"
          style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; color: white; cursor: pointer; margin-right: 10px;"
          [style.background-color]="isStreaming ? '#dc3545' : '#28a745'"
          [style.opacity]="!selectedMicId || websocketStatus !== 'connected' ? '0.5' : '1'">
          {{ isStreaming ? '🛑 Stop Streaming' : '🎙 Start WebRTC Streaming' }}
        </button>

        <button 
          (click)="clearResults()"
          [disabled]="isStreaming"
          style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: 1px solid #ccc; background-color: #f8f9fa; color: #333; cursor: pointer;"
          [style.opacity]="isStreaming ? '0.5' : '1'">
          🗑️ Clear Results
        </button>
      </div>

      <!-- 실시간 상태 표시 -->
      <div style="margin-bottom: 2rem;">
        <div *ngIf="isStreaming" style="padding: 1rem; border-radius: 8px; background-color: #d4edda; border: 1px solid #c3e6cb;">
          <div style="color: #155724; font-weight: bold; margin-bottom: 0.5rem;">
            🔴 WebRTC 실시간 스트리밍 중... 
          </div>
          <div style="font-size: 12px; color: #155724;">
            • aiortc 서버로 실시간 오디오 전송<br>
            • 서버에서 VAD + Whisper 자동 처리<br>
            • WebSocket으로 결과 수신<br>
            • 총 {{ totalSttResults }}개 결과 수신됨
          </div>
        </div>
        
        <div *ngIf="!isStreaming" style="padding: 1rem; border-radius: 8px; background-color: #f8f9fa; border: 1px solid #dee2e6;">
          <div style="color: #6c757d; font-weight: bold; margin-bottom: 0.5rem;">
            💤 대기 중
          </div>
          <div style="font-size: 12px; color: #6c757d;">
            WebRTC 스트리밍을 시작하면 실시간으로 음성을 처리합니다
          </div>
        </div>
      </div>

      <!-- STT 결과 -->
      <div style="text-align: left;">
        <h3 style="text-align: center; margin-bottom: 1rem;">
          📝 실시간 STT 결과 ({{ totalSttResults }}개)
        </h3>
        <div style="border: 1px solid #ddd; border-radius: 8px; padding: 1rem; background-color: #f8f9fa; min-height: 300px; max-height: 600px; overflow-y: auto;">
          <div *ngIf="sttResults.length === 0" style="color: #999; text-align: center; padding: 2rem;">
            WebRTC 스트리밍을 시작하고 말하면 여기에 텍스트가 나타납니다.<br>
            <small>서버의 aiortc + VAD + Whisper가 실시간으로 처리합니다.</small>
          </div>
          
          <div *ngFor="let result of sttResults; let i = index" 
               style="margin-bottom: 15px; padding: 12px; border-radius: 6px; background-color: white; border-left: 4px solid #007bff;">
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 8px;">
              <div style="font-size: 12px; color: #666;">
                #{{ totalSttResults - sttResults.length + i + 1 }} | {{ result.timestamp }}
              </div>
              <div style="font-size: 12px; color: #666;">
                [{{ result.language }}] {{ result.duration }}초 | 처리: {{ result.processingTime }}초
              </div>
            </div>
            <div style="font-size: 16px; word-break: break-word; line-height: 1.4;">
              {{ result.text }}
            </div>
          </div>
        </div>
      </div>

      <!-- 로그 확인 안내 -->
      <div style="margin-top: 2rem; padding: 1rem; border-radius: 8px; background-color: #fff3cd; border: 1px solid #ffeaa7;">
        <div style="color: #856404; font-weight: bold; margin-bottom: 0.5rem;">
          🔍 상세 로그 확인 방법
        </div>
        <div style="font-size: 12px; color: #856404;">
          • <strong>브라우저:</strong> 개발자 도구 (F12) → Console 탭<br>
          • <strong>서버:</strong> Python WebRTC 서버 터미널<br>
          • WebRTC 연결, 오디오 프레임, VAD, STT 전 과정을 실시간 확인
        </div>
      </div>

      <!-- 기술 정보 -->
      <div style="margin-top: 2rem; font-size: 12px; color: #666; text-align: left;">
        <strong>📡 기술 구성:</strong><br>
        • <strong>클라이언트:</strong> Angular + WebRTC (RTCPeerConnection)<br>
        • <strong>서버:</strong> Python + aiortc + aiohttp<br>
        • <strong>오디오 처리:</strong> 실시간 VAD (webrtcvad) + Whisper<br>
        • <strong>통신:</strong> WebRTC (오디오) + WebSocket (결과)<br>
        • <strong>특징:</strong> CLI와 동일한 성능, 웹 기반 실시간 처리
      </div>
    </div>
  `,
  standalone: true
})
export class WebRTCSTTComponent implements OnInit, OnDestroy {
  // 상태
  isStreaming = false;
  webrtcStatus = 'disconnected';
  websocketStatus = 'disconnected';
  currentStatus = '대기 중';
  
  // WebRTC
  peerConnection: RTCPeerConnection | null = null;
  localStream: MediaStream | null = null;
  
  // WebSocket
  websocket: WebSocket | null = null;
  
  // 마이크
  microphones: MediaDeviceInfo[] = [];
  selectedMicId = '';
  
  // 결과
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

  // 마이크 목록 로드
  async loadMicrophones() {
    try {
      console.log('🎤 마이크 권한 요청 중...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.microphones = devices.filter(d => d.kind === 'audioinput');
      
      if (this.microphones.length > 0) {
        this.selectedMicId = this.microphones[0].deviceId;
        console.log(`✅ 기본 마이크 선택: ${this.getSelectedMicName()}`);
      }
      
      console.log(`🎤 사용가능한 마이크: ${this.microphones.length}개`);
    } catch (error) {
      console.error('❌ 마이크 권한 오류:', error);
      alert('마이크 권한을 허용해주세요!');
    }
  }

  // WebSocket 연결
  connectWebSocket() {
    console.log('🔌 WebSocket 연결 시도...');
    this.websocket = new WebSocket('ws://localhost:5001/ws');
    
    this.websocket.onopen = () => {
      console.log('✅ WebSocket 연결됨');
      this.websocketStatus = 'connected';
    };
    
    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket 메시지:', data);
        
        if (data.type === 'stt_result') {
          this.totalSttResults++;
          const timestamp = new Date(data.timestamp * 1000).toLocaleTimeString();
          
          this.sttResults.push({
            text: data.text,
            language: data.language,
            timestamp: timestamp,
            duration: data.audio_duration?.toFixed(1) || '?',
            processingTime: data.processing_time?.toFixed(2) || '?',
            audioLevel: data.audio_level?.toFixed(0) || '?'
          });
          
          // 최대 20개 결과만 유지
          if (this.sttResults.length > 20) {
            this.sttResults.shift();
          }
          
          this.currentStatus = `✅ STT 완료 #${this.totalSttResults}`;
          console.log(`🎉 STT 결과 #${this.totalSttResults}: ${data.text}`);
          
        } else if (data.type === 'status') {
          this.currentStatus = data.message;
          console.log(`📢 상태: ${data.message}`);
          
        } else if (data.type === 'connected') {
          console.log('🤝 WebSocket 연결 확인됨');
        }
      } catch (error) {
        console.error('❌ WebSocket 메시지 파싱 오류:', error);
      }
    };
    
    this.websocket.onclose = () => {
      console.log('❌ WebSocket 연결 해제됨');
      this.websocketStatus = 'disconnected';
      this.currentStatus = '❌ WebSocket 연결 해제됨';
    };
    
    this.websocket.onerror = (error) => {
      console.error('🚫 WebSocket 오류:', error);
      this.websocketStatus = 'error';
      this.currentStatus = '🚫 WebSocket 오류';
    };
  }

  // WebSocket 연결 해제
  disconnectWebSocket() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  // WebRTC 스트리밍 시작
  async startStreaming() {
    if (!this.selectedMicId || this.websocketStatus !== 'connected') {
      alert('마이크를 선택하고 WebSocket 연결을 확인하세요!');
      return;
    }

    try {
      console.log('🚀 WebRTC 스트리밍 시작');
      this.sessionStartTime = Date.now();
      this.currentStatus = '🔄 WebRTC 연결 중...';
      
      // 마이크 스트림 생성
      console.log(`🎤 선택된 마이크: ${this.selectedMicId}`);
      
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: this.selectedMicId },
          echoCancellation: false,  // 테스트를 위해 비활성화
          noiseSuppression: false,  // 테스트를 위해 비활성화
          autoGainControl: false,   // 테스트를 위해 비활성화
          sampleRate: 48000,        // 명시적 설정
          channelCount: 1           // 모노 설정
        }
      });
      
      console.log('🎤 마이크 스트림 생성됨');
      console.log(`📊 스트림 정보: ${this.localStream.getAudioTracks().length}개 오디오 트랙`);
      
      // RTCPeerConnection 생성 (강화된 설정)
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      });
      
      // 오디오 트랙 추가
      const audioTracks = this.localStream.getAudioTracks();
      console.log(`🎤 사용가능한 오디오 트랙: ${audioTracks.length}개`);
      
      audioTracks.forEach((track, index) => {
        console.log(`🎵 트랙 ${index}: ${track.label}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
        this.peerConnection!.addTrack(track, this.localStream!);
        console.log(`✅ 오디오 트랙 ${index} 추가됨`);
      });

      if (audioTracks.length === 0) {
        console.error('❌ 오디오 트랙이 없습니다!');
        throw new Error('오디오 트랙을 찾을 수 없습니다');
      }
      
      // ICE 연결 상태 모니터링
      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection!.iceConnectionState;
        console.log(`🧊 ICE 연결 상태: ${state}`);
        this.webrtcStatus = state;
        
        if (state === 'connected' || state === 'completed') {
          this.currentStatus = '✅ WebRTC 연결됨, 스트리밍 중';
          this.isStreaming = true;
        } else if (state === 'failed') {
          console.error('❌ ICE 연결 실패 - 재시도 중...');
          this.currentStatus = '🔄 연결 실패, 재시도 중...';
          // 재시도 로직
          setTimeout(() => {
            if (this.peerConnection && this.peerConnection.iceConnectionState === 'failed') {
              console.log('🔄 WebRTC 재연결 시도...');
              this.restartIce();
            }
          }, 2000);
        } else if (state === 'disconnected') {
          this.currentStatus = '❌ WebRTC 연결 해제됨';
          this.isStreaming = false;
        } else if (state === 'checking') {
          this.currentStatus = '🔍 ICE 연결 확인 중...';
        }
      };

      // 연결 상태 모니터링 추가
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection!.connectionState;
        console.log(`🔗 연결 상태: ${state}`);
        
        if (state === 'failed') {
          console.error('❌ PeerConnection 실패');
          this.currentStatus = '❌ 연결 실패';
        }
      };

      // ICE candidate 이벤트 추가
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 ICE candidate:', event.candidate.candidate);
        } else {
          console.log('🧊 ICE gathering 완료');
        }
      };

      // ICE 연결 타임아웃 (10초)
      setTimeout(() => {
        if (this.peerConnection && this.peerConnection.iceConnectionState === 'checking') {
          console.log('⏰ ICE 연결 타임아웃 - 강제로 연결 시도');
          this.webrtcStatus = 'connected';
          this.currentStatus = '✅ WebRTC 연결됨 (강제), 스트리밍 중';
          this.isStreaming = true;
        }
      }, 10000);
      
      // Offer 생성 (오디오 전용)
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await this.peerConnection.setLocalDescription(offer);
      
      console.log('📝 Offer SDP:', offer.sdp?.substring(0, 200) + '...');
      
      console.log('📤 서버에 Offer 전송 중...');
      
      // 서버에 Offer 전송
      const response = await fetch('http://localhost:5001/offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sdp: offer.sdp,
          type: offer.type,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status}`);
      }
      
      const answer = await response.json();
      console.log('📥 서버 Answer 수신됨');
      
      // Answer 설정
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({
          sdp: answer.sdp,
          type: answer.type,
        })
      );
      
      console.log('✅ WebRTC 연결 설정 완료');
      this.currentStatus = '🎤 WebRTC 스트리밍 시작됨';
      
    } catch (error) {
      console.error('❌ WebRTC 시작 실패:', error);
      this.currentStatus = '❌ WebRTC 시작 실패';
      this.webrtcStatus = 'failed';
      alert(`WebRTC 연결 실패: ${error}`);
      this.stopStreaming();
    }
  }

  // 스트리밍 중지
  stopStreaming() {
    console.log('🛑 WebRTC 스트리밍 중지');
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('⏹️ 트랙 중지됨');
      });
      this.localStream = null;
    }
    
    this.isStreaming = false;
    this.webrtcStatus = 'disconnected';
    
    const sessionDuration = (Date.now() - this.sessionStartTime) / 1000;
    console.log(`✅ 세션 완료: ${sessionDuration.toFixed(1)}초, ${this.totalSttResults}개 STT 결과`);
    this.currentStatus = `✅ 세션 완료: ${sessionDuration.toFixed(1)}초`;
  }

  // 결과 지우기
  clearResults() {
    console.log('🗑️ 결과 지우기');
    this.sttResults = [];
    this.totalSttResults = 0;
    this.currentStatus = '🗑️ 결과 지워짐';
  }

  // 선택된 마이크 이름
  getSelectedMicName(): string {
    const selectedMic = this.microphones.find(mic => mic.deviceId === this.selectedMicId);
    return selectedMic?.label || `마이크 ${this.microphones.indexOf(selectedMic!) + 1}`;
  }

  // 세션 통계
  getSessionStats(): string {
    if (!this.isStreaming) return '';
    const duration = (Date.now() - this.sessionStartTime) / 1000;
    return `${duration.toFixed(0)}초 스트리밍, ${this.totalSttResults}개 STT 결과`;
  }

  // ICE 재시작
  async restartIce() {
    try {
      console.log('🔄 ICE 재시작 중...');
      if (this.peerConnection) {
        await this.peerConnection.restartIce();
        console.log('✅ ICE 재시작 완료');
      }
    } catch (error) {
      console.error('❌ ICE 재시작 실패:', error);
      this.currentStatus = '❌ ICE 재시작 실패';
    }
  }
} 
