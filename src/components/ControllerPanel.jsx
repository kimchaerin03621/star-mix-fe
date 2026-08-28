import React from 'react';

function MidiBadge({ active, children }) {
  return <span className={`controller-badge ${active ? 'active' : ''}`}>{children}</span>;
}

export function ControllerPanel({
  isSupported,
  status,
  inputs,
  selectedInputId,
  onRequestAccess,
  onSelectInput,
  lastMidiMessage,
  activeSong,
  activePreset,
  leftRate,
  rightRate,
  leftVolume = 1.0,
  rightVolume = 1.0,
  drumPads = [],
  activePads = {},
  onTriggerPad,
  onBack,
  onOpenDj,
  mappingGroup = 'group1',
  onSelectMappingGroup = () => {},
}) {
  const isGroup2 = mappingGroup === 'group2';

  const group1Items = [
    { tag: 'PAD 1 ~ 8', desc: '8종 퍼포먼스 드럼 연주 (Kick, Snare, Hi-Hat, Clap...)' },
    { tag: 'FADER 1', desc: '채널 1 (Vocal) 볼륨 조절 (0% ~ 100%)' },
    { tag: 'FADER 2', desc: '채널 2 (Drum) 볼륨 조절 (0% ~ 100%)' },
    { tag: 'X-FADER', desc: '좌/우 트랙 크로스페이더 볼륨 믹싱' },
    { tag: 'BTN 1', desc: '채널 1 즉시 음소거 (Mute Toggle)' },
    { tag: 'BTN 2', desc: '채널 2 즉시 음소거 (Mute Toggle)' },
    { tag: 'BTN 3', desc: 'DJ 화면 즉시 열기' },
    { tag: 'BTN 4', desc: '메인 선택 메뉴로 이동' },
    { tag: 'KNOB 1', desc: '채널 1 BPM 템포 속도 (0.5x ~ 1.5x)' },
    { tag: 'KNOB 2', desc: '채널 2 BPM 템포 속도 (0.5x ~ 1.5x)' },
  ];

  const group2Items = [
    { tag: 'EQ HIGH', desc: 'X축 이동 (오른쪽 돌림 ➡️ 우, 왼쪽 돌림 ⬅️ 좌, 12시 멈춤)' },
    { tag: 'EQ MID', desc: 'Y축 이동 (오른쪽 돌림 ⬆️ 위, 왼쪽 돌림 ⬇️ 아래, 12시 멈춤)' },
    { tag: 'EQ LOW', desc: 'Z축 이동 (오른쪽 돌림 ⏩ 앞, 왼쪽 돌림 ⏪ 뒤, 12시 멈춤)' },
    { tag: 'MASTER / RESET', desc: '카메라 시점을 정중앙 원점(0,0,0)으로 즉시 초기화 (Reset View)' },
    { tag: 'FADER 1 / 2', desc: '추가 VR 카메라 & 시점 보조 조작' },
    { tag: 'BTN 2 ~ 4', desc: 'VR 화면 모드 / 에디터 / 메뉴 이동' },
    { tag: 'PAD 1 ~ 8', desc: 'VR 퍼포먼스 SFX & 트리거' },
  ];

  const summaryItems = isGroup2 ? group2Items : group1Items;

  return (
    <div className="controller-overlay">
      <div className="controller-shell">
        <div className="controller-hero">
          <p className="controller-eyebrow">MIDI CONTROLLER LAB</p>
          <h2 className="controller-title">DJ 컨트롤러 듀얼 매핑 프로필</h2>
          <p className="controller-copy">
            그룹 1(DJ 믹서 & 드럼)과 그룹 2(FX 필터 & 코스믹 신스 SFX) 중 원하시는 매핑 그룹을 선택하여 컨트롤러의 페이더, 노브, 패드 기능을 다양하게 활용해보세요!
          </p>

          {/* Group Profile Selector Tabs */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={() => onSelectMappingGroup('group1')}
              style={{
                flex: 1,
                padding: '12px 18px',
                borderRadius: '8px',
                border: !isGroup2 ? '2px solid #D0411A' : '1px solid rgba(255,255,255,0.15)',
                background: !isGroup2 ? 'rgba(208, 65, 26, 0.25)' : 'rgba(0,0,0,0.4)',
                color: !isGroup2 ? '#FFD336' : '#888888',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: "'Share Tech Mono', monospace",
                letterSpacing: '1px'
              }}
            >
              🎧 GROUP 1: DJ MIXER & DRUMS
            </button>
            <button
              onClick={() => onSelectMappingGroup('group2')}
              style={{
                flex: 1,
                padding: '12px 18px',
                borderRadius: '8px',
                border: isGroup2 ? '2px solid #00ffcc' : '1px solid rgba(255,255,255,0.15)',
                background: isGroup2 ? 'rgba(0, 255, 204, 0.2)' : 'rgba(0,0,0,0.4)',
                color: isGroup2 ? '#00ffcc' : '#888888',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: "'Share Tech Mono', monospace",
                letterSpacing: '1px'
              }}
            >
              🚀 GROUP 2: FX FILTER & COSMIC SYNTH
            </button>
          </div>
        </div>

        <div className="controller-actions">
          <button className="controller-connect-btn" onClick={onRequestAccess}>
            컨트롤러 연결하기
          </button>
          <button className="controller-enter-dj-btn" onClick={onOpenDj}>
            웹캠 DJ 화면 진입
          </button>
        </div>

        <div className="controller-grid">
          <div className="controller-device-card">
            <div className="controller-card-title">MIDI 장치 상태</div>
            <div className="controller-status-line">
              <MidiBadge active={inputs.length > 0}>{status}</MidiBadge>
            </div>
            {isSupported ? (
              inputs.length > 0 ? (
                <div className="controller-input-select-group">
                  <label htmlFor="midi-select">연결된 MIDI 입력 장치 선택</label>
                  <select
                    id="midi-select"
                    className="controller-select"
                    value={selectedInputId || ''}
                    onChange={(e) => onSelectInput(e.target.value)}
                  >
                    {inputs.map((input) => (
                      <option key={input.id} value={input.id}>
                        {input.name || `MIDI Device (${input.id})`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="controller-note">
                  연결 가능한 MIDI 장치를 찾지 못했어요. 컨트롤러 USB 케이블을 확인 후 <strong>컨트롤러 연결하기</strong>를 누르세요.
                </p>
              )
            ) : (
              <p className="controller-note warn">
                이 브라우저는 Web MIDI API를 지원하지 않아요. Chrome / Edge 브라우저 이용을 권장합니다.
              </p>
            )}
          </div>

          <div className="controller-device-card">
            <div className="controller-card-title">
              {isGroup2 ? '🚀 그룹 2 퍼포먼스 패드 (COSMIC SYNTH & SFX)' : '🥁 그룹 1 퍼포먼스 드럼 패드 (REAL DRUM KITS)'}
            </div>
            <div className="controller-pads-grid">
              {drumPads.map((pad) => {
                const isActive = activePads[pad.id];
                return (
                  <button
                    key={pad.id}
                    className={`controller-pad-btn ${isActive ? 'active' : ''}`}
                    style={{
                      borderColor: pad.color,
                      boxShadow: isActive ? `0 0 16px ${pad.color}` : 'none',
                    }}
                    onClick={() => onTriggerPad(pad.id)}
                  >
                    <span className="controller-pad-key">KEY {pad.key}</span>
                    <span className="controller-pad-name" style={{ color: pad.color }}>
                      {pad.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="controller-device-card">
            <div className="controller-card-title">현재 반영 중인 값 (LIVE PARAMETERS)</div>
            <div className="controller-live-grid">
              <div className="controller-live-item">
                <span>Left Vol / LPF</span>
                <strong>{Math.round(leftVolume * 100)}%</strong>
              </div>
              <div className="controller-live-item">
                <span>Right Vol / HPF</span>
                <strong>{Math.round(rightVolume * 100)}%</strong>
              </div>
              <div className="controller-live-item">
                <span>Left Rate / Q</span>
                <strong>{leftRate.toFixed(2)}</strong>
              </div>
              <div className="controller-live-item">
                <span>Right Rate / Warp</span>
                <strong>{rightRate.toFixed(2)}</strong>
              </div>
            </div>
            <div className="controller-message-box">
              <div className="controller-card-title small">마지막 감지된 입력 (LIVE SIGNAL MONITOR)</div>
              {lastMidiMessage ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span className="controller-badge active" style={{ background: '#ff007f', color: '#ffffff', fontSize: '0.82rem', padding: '3px 10px', borderRadius: '6px', fontWeight: '800' }}>
                      {lastMidiMessage.controlTag || 'SIGNAL'}
                    </span>
                    <strong style={{ color: '#00ffcc', fontSize: '0.92rem' }}>
                      {lastMidiMessage.type} | ch {lastMidiMessage.channel} | note/cc: {lastMidiMessage.data1}, val: {lastMidiMessage.data2}
                    </strong>
                  </div>
                  <p style={{ color: '#ffffff', fontSize: '0.88rem', margin: 0, fontWeight: '700' }}>
                    ⚡ 실행 기능: <span style={{ color: '#ff007f' }}>{lastMidiMessage.actionDesc}</span>
                  </p>
                </div>
              ) : (
                <p>아직 들어온 MIDI 신호가 없어요. 컨트롤러의 버튼/페이더/노브를 조작해보세요.</p>
              )}
            </div>
          </div>
        </div>

        <div className="controller-map-card">
          <div className="controller-card-title">
            {isGroup2 ? '🚀 [GROUP 2: FX & COSMIC SYNTH] 매핑 요약' : '🎧 [GROUP 1: DJ MIXER & DRUMS] 매핑 요약'}
          </div>
          <div className="controller-map-grid">
            {summaryItems.map((item) => {
              const isSelected = lastMidiMessage?.controlTag === item.tag || (item.tag === 'PAD 1 ~ 8' && lastMidiMessage?.controlTag?.startsWith('PAD'));
              return (
                <div
                  key={item.tag}
                  className={`controller-map-item ${isSelected ? 'active-map-highlight' : ''}`}
                  style={{
                    border: isSelected ? '1px solid #ff007f' : '1px solid rgba(255,255,255,0.08)',
                    background: isSelected ? 'rgba(255, 0, 127, 0.15)' : 'rgba(255,255,255,0.03)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <strong style={{ color: isSelected ? '#00ffcc' : '#ffffff' }}>[{item.tag}]</strong>
                  <span>{item.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
