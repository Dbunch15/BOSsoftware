import { describeViolation } from '../rules/describe';
import { NATURI_SPECS } from '../specs/naturiSpecs';
import { useModel } from '../state/docStore';
import { useUi } from '../state/uiStore';
import { Icon } from './icons';

export function WarningsPanel() {
  const model = useModel();
  const selection = useUi((s) => s.selection);
  const units = model.doc.units;
  const vs = model.violations;
  const crit = vs.filter((v) => v.severity === 'critical').length;
  return (
    <>
      <div className="section" style={{ borderBottom: 0, paddingBottom: 6 }}>
        <h3 className="section-title" style={{ marginBottom: 0 }}>
          Warnings
          <span className="count" data-testid="warning-count">
            {vs.length}
          </span>
        </h3>
      </div>
      {vs.length === 0 ? (
        <div className="warnings-empty" data-testid="warnings-empty">
          <Icon name="check" size={16} /> All checks pass against the current spec table.
        </div>
      ) : (
        <>
          <div className="review-note">
            Design review required — {vs.length} open item{vs.length === 1 ? '' : 's'}
            {crit ? ` (${crit} critical)` : ''} will print on sheets. Export is never blocked.
          </div>
          <div className="warnings-list" data-testid="warnings-list">
            {vs.map((v) => (
              <button
                key={v.id}
                className={`warning ${v.severity}`}
                data-testid="warning-item"
                data-rule={v.ruleId}
                aria-current={selection?.kind === 'violation' && selection.id === v.id}
                onClick={() => {
                  useUi.getState().select({ kind: 'violation', id: v.id });
                  useUi.getState().focusOn(v.at);
                }}
              >
                <span className="dot">!</span>
                <span>
                  <div className="warning-title">{v.title}</div>
                  <div className="warning-detail">{describeViolation(v, units)}</div>
                  <div className="warning-hint">
                    {v.hint}
                    {!NATURI_SPECS[v.specKey].verified && ' · spec value unverified'}
                  </div>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
