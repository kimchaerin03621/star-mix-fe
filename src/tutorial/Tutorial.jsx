import './Tutorial.css';
import { TUTORIAL_STEPS } from './tutorialSteps';
import { useTutorial } from './useTutorial';

// The first-visit tutorial (see tutorialSteps.js for the steps and useTutorial.js for the flow).
export function Tutorial({ enabled, handData }) {
  const { phase, step, confirm, skip } = useTutorial({ enabled, handData });
  if (!enabled) return null;
  const current = TUTORIAL_STEPS[step];
  const total = TUTORIAL_STEPS.length;

  return (
    <>
      {phase === 'intro' && (
        <div className="tutorial-backdrop" role="dialog" aria-label={current.title} data-testid="tutorial-intro">
          <div className="tutorial-card">
            <div className="tutorial-progress" aria-hidden="true">
              {TUTORIAL_STEPS.map((item, index) => (
                <span key={item.id} className={index === step ? 'on' : index < step ? 'done' : ''} />
              ))}
            </div>
            <p className="tutorial-step">{step + 1} / {total}</p>
            <h2 className="tutorial-title">{current.title}</h2>
            {current.lines.map((line) => <p key={line} className="tutorial-line">{line}</p>)}
            <p className="tutorial-mouse">{current.mouse}</p>
            <button type="button" className="tutorial-confirm" onClick={confirm} autoFocus>확인</button>
            <button type="button" className="tutorial-skip" onClick={skip}>건너뛰기</button>
          </div>
        </div>
      )}

      {phase === 'doing' && (
        <div className="tutorial-pill" data-testid="tutorial-hint">
          <span className="tutorial-pill-step">{step + 1}/{total}</span>
          {current.hint}
        </div>
      )}

      {(phase === 'success' || phase === 'between') && (
        <div className="tutorial-pill success" data-testid="tutorial-success">✓ 잘했어요</div>
      )}

      {phase === 'finale' && (
        <div className="tutorial-pill success" data-testid="tutorial-finale">이제 마음껏 사운드를 움직여 보세요</div>
      )}
    </>
  );
}
