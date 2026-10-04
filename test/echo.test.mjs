import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ECHO_WINDOWS,
    ECHO_WINDOW_INFO,
    ECHO_CASES,
    evaluateEchoSignal
} from '../js/echo-engine.js';

test('Echo Engine — Définition des 5 fenêtres FAST-Echo standard', () => {
    const requiredWindows = ['subxiphoid', 'morrison', 'splenorenal', 'pelvis', 'lung'];
    requiredWindows.forEach(w => {
        assert.ok(ECHO_WINDOW_INFO[w], `La fenêtre ${w} doit être définie`);
        assert.ok(ECHO_WINDOW_INFO[w].name);
        assert.ok(ECHO_WINDOW_INFO[w].searchItem);
    });
});

test('Echo Engine — Intégrité des cas cliniques FAST', () => {
    assert.ok(ECHO_CASES.length >= 3);
    ECHO_CASES.forEach(c => {
        assert.ok(c.id);
        assert.ok(c.title);
        assert.ok(c.correctWindow);
        assert.ok(ECHO_WINDOW_INFO[c.correctWindow], 'La fenêtre correcte doit exister');
        assert.ok(c.findings[c.correctWindow]);
        assert.ok(c.correctAction);
        assert.ok(c.distractors.length >= 2);
    });
});

test('Echo Engine — Réglages ultrasonores Gain & Profondeur', () => {
    // Gain optimal ~50%
    const resOptimal = evaluateEchoSignal(50, 12, 'morrison');
    assert.ok(resOptimal.contrastScore >= 0.8);
    assert.ok(resOptimal.isOptimal);

    // Gain sous-dosé (< 20%)
    const resDark = evaluateEchoSignal(15, 12, 'morrison');
    assert.ok(resDark.contrastScore < 0.6);
    assert.equal(resDark.isOptimal, false);

    // Profondeur inadaptée au poumon (> 8 cm)
    const resLungDeep = evaluateEchoSignal(50, 16, 'lung');
    assert.ok(resLungDeep.depthScore < 0.8);
});
