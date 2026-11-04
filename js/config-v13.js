// v13 settings: ads manager holds a reputation target; GM minimum hire skill.
(function () {
  const TG = globalThis.TG;
  const C = TG.CONFIG;
  C.v13 = {
    repTargets: [0, 60, 70, 80, 90],      // 0 = off
    repDefault: 70,                        // used when an ads manager is hired and nothing was picked
    rep: {
      ptMin: 250,        // $ per reputation point at least (x price index)
      ptRev: 0.012,      // or this share of monthly revenue per point, whichever is more
      costSkill: [1.45, 0.7], // cost multiplier = a - b * skill/100  (skill 0: x1.45, skill 100: x0.75)
      step: [3, 5],      // points per month at most = a + b * skill/100
      ok: [0.65, 0.3],   // chance a month's push lands = a + b * skill/100
      hitAllow: 0.5,     // expected small knocks per month (fights, flops, closed days), for the cost estimate
    },
    minSkills: [0, 30, 40, 50, 60, 70, 80], // 0 = any skill
    minNoteEvery: 3,    // months between 'nobody good enough' notes per role
  };
  C.specialists.ads.desc = 'Makes ad spend work harder, runs campaigns after reputation drops, and holds the reputation target you pick.';
})();
