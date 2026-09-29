import test from 'node:test';
import assert from 'node:assert/strict';
import {planEdit, tokenize, numberWords} from '../../../shorts/neetcode-150/part-01/scripts/edit-plan.mjs';

// Evenly spaced words: [text, start] with 0.25 s duration unless an end is given.
const words = list => list.map(([text, start, end]) => ({text, start, end: end ?? start + .25}));
const sceneFramesAddUp = plan => {
  assert.equal(plan.segments.reduce((sum, s) => sum + s.frames, 0), plan.frames);
  assert.equal(plan.scenes[0].startFrame, 0);
  plan.scenes.forEach((s, i) => assert.equal(s.startFrame + s.frames, plan.scenes[i + 1]?.startFrame ?? plan.frames));
};

test('numbers read the same whether recognised as digits or written as words', () => {
  assert.deepEqual(numberWords(100000), ['one', 'hundred', 'thousand']);
  assert.deepEqual(tokenize('100,000 numbers').map(t => t.norm), ['one', 'hundred', 'thousand', 'numbers']);
  assert.deepEqual(tokenize("Part one: Contains Duplicate.").map(t => t.norm), ['part', 'one', 'contains', 'duplicate']);
});

test('removes a mid-sentence flub and tightens long pauses (recorded sample)', () => {
  // Recognised words from a real take: "...and false if any number, every number is unique."
  const recognised = words([
    ['Can', .3], ['you', .82], ['spot', .9], ['the', 1.14], ['duplicate?', 1.32], ['Easy,', 2.24], ['now', 2.78], ['do', 3.02], ['it', 3.16], ['for', 3.28],
    ['100,000', 3.44, 4.06], ['numbers', 4.06], ['fast.', 4.38, 5.1],
    ['NeetCode', 6.52, 7], ['150,', 7, 7.64], ['part', 7.64], ['1.', 7.8], ['Contains', 8.06], ['Duplicate.', 8.5, 9.04],
    ['Given', 9.85], ['an', 10.1], ['array,', 10.3], ['return', 10.6], ['true', 10.9], ['if', 11.14], ['any', 11.36], ['number', 11.58], ['appears', 11.88], ['twice', 12.24, 12.68],
    ['and', 13.3], ['false', 13.52], ['if', 13.9, 14.2], ['any', 14.76], ['number,', 14.95, 15.25], ['every', 15.41], ['number', 15.6], ['is', 15.84], ['unique.', 16.02, 16.39],
  ]);
  const scenes = [
    {id: 'hook', voice: 'Can you spot the duplicate? Easy. Now do it for one hundred thousand numbers, fast.'},
    {id: 'problem', voice: 'NeetCode one fifty, Part one: Contains Duplicate. Given an array, return true if any number appears twice, and false if every number is unique.'},
  ];
  const plan = planEdit({words: recognised, scenes, duration: 16.93});
  const retakes = plan.cuts.filter(c => c.reason === 'retake');
  assert.equal(retakes.length, 1);
  assert.equal(retakes[0].text, 'any number,');
  // "150" vs "one fifty" and "1" vs "one" are recognition differences, never cuts.
  assert.ok(!plan.cuts.some(c => /150|part|1\./.test(c.text)));
  assert.ok(plan.cuts.some(c => c.reason === 'pause' && c.start > 5 && c.end < 6.6));
  assert.ok(plan.duration < 15.2 && plan.duration > 13);
  assert.equal(plan.scenes[1].id, 'problem');
  // The problem scene starts in the (tightened) pause after "fast.", in edited-output time.
  const problemStart = plan.scenes[1].startFrame / 30;
  assert.ok(problemStart > 4.3 && problemStart < 5, `problem starts at ${problemStart}`);
  sceneFramesAddUp(plan);
});

test('keeps the later take when a line is restarted', () => {
  const recognised = words([['Given', 0], ['an', .3], ['array', .6], ['Given', 1.5], ['an', 1.8], ['array,', 2.1], ['return', 2.4], ['true.', 2.7]]);
  const plan = planEdit({words: recognised, scenes: [{id: 'problem', voice: 'Given an array, return true.'}], duration: 3.5});
  assert.deepEqual(plan.cuts.filter(c => c.reason === 'retake').map(c => [c.start, c.text]), [[0, 'Given an array']]);
  assert.ok(plan.segments[0].start >= 1.3);
  sceneFramesAddUp(plan);
});

test('drops chatter before and after the script, keeps single recognition slips', () => {
  const recognised = words([['okay', 0], ['recording', .3], ['Follow', 1.2], ['for', 1.5], ['Part', 1.8], ['two', 2.1], ['of', 2.4], ['NeetCode', 2.7], ['one', 3], ['fifty.', 3.3], ['cut', 4.5], ['there', 4.8]]);
  const plan = planEdit({words: recognised, scenes: [{id: 'cta', voice: 'Follow for Part two of NeetCode one fifty.'}], duration: 5.5});
  assert.deepEqual(plan.cuts.filter(c => c.reason !== 'pause').map(c => c.reason), ['before script', 'after script']);
  assert.ok(plan.segments[0].start > .9 && plan.segments.at(-1).end < 4.5);

  const slip = planEdit({words: words([['Follow', 0], ['for', .3], ['uh', .6], ['Part', .9], ['two.', 1.2]]), scenes: [{id: 'cta', voice: 'Follow for Part two.'}], duration: 2});
  assert.deepEqual(slip.cuts.map(c => c.reason), ['filler']);
  const noise = planEdit({words: words([['Follow', 0], ['for', .3], ['the', .6], ['Part', .9], ['two.', 1.2]]), scenes: [{id: 'cta', voice: 'Follow for Part two.'}], duration: 2});
  assert.deepEqual(noise.cuts, []);
});

test('fails clearly when a scene is missing from the take', () => {
  assert.throws(() => planEdit({words: words([['Can', 0], ['you', .3], ['spot', .6]]), scenes: [{id: 'hook', voice: 'Can you spot'}, {id: 'problem', voice: 'Given an array'}], duration: 2}), /Scene "problem" was not found/);
});

test('respects removeRetakes false and a pause that is not silent', () => {
  const recognised = words([['Given', 0], ['an', .3], ['array', .6], ['Given', 1.5], ['an', 1.8], ['array,', 2.1], ['return', 2.4], ['true.', 2.7]]);
  const kept = planEdit({words: recognised, scenes: [{id: 'problem', voice: 'Given an array, return true.'}], duration: 3.5, options: {removeRetakes: false}});
  assert.equal(kept.cuts.filter(c => c.reason !== 'pause').length, 0);
  assert.ok(kept.segments[0].start < .1);
  // A 1 s gap containing unrecognised sound (not in `silences`) is left alone.
  const gap = planEdit({words: words([['Easy.', 0], ['Now', 1.5]]), scenes: [{id: 'hook', voice: 'Easy. Now'}], duration: 2.2, silences: [{start: 1.9, end: 2.2}]});
  assert.equal(gap.cuts.length, 0);
});

test('cuts a pause inside detected silence, not at recognised word edges', () => {
  // "Fast." is recognised as ending at 5.10 but is audible until 5.35; the silence runs 5.35–6.52 (real recording).
  const plan = planEdit({words: words([['fast.', 4.84, 5.1], ['NeetCode', 6.42, 6.9]]), scenes: [{id: 'hook', voice: 'fast.'}, {id: 'problem', voice: 'NeetCode'}], duration: 7.5,
    silences: [{start: 4.58, end: 4.86}, {start: 5.35, end: 6.2}, {start: 6.2, end: 6.52}]});
  const [pause] = plan.cuts;
  assert.equal(pause.reason, 'pause');
  // Silence is clipped to the gap (it ends where "NeetCode" starts, 6.42), keeping 0.15 s of it on each side.
  assert.ok(Math.abs(pause.start - 5.5) < .01 && Math.abs(pause.end - 6.27) < .01, JSON.stringify(pause));
  sceneFramesAddUp(plan);
});
