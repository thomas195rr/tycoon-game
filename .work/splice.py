s=open('../js/models.js').read()
a=s.index("  M.farmHerdCap = (prop, e)")
w0=s.index("    weather(g, b, ctx, growing) {"); w1=s.index("    sell(g, b, tons, label) {")
weather=s[w0:w1]
e0=s.index("    endSeason(g, b) {"); e1=s.index("    sellStored(g, b, tons) {")
endSeason=s[e0:e1]
x0=s.index("    baseYieldNote(b)"); x1=s.index("    inventoryValue(g, b) {\n      const f = b.farm")
extra=s[x0:x1]
inv='''    inventoryValue(g, b) {
      const f = b.farm, e = this.e(b);
      let v = (f.stored || 0) * TG.W.price(g, e.market, 0) * 0.9 + (f.seeds || 0) * this.seedCost(g, b) * 0.8;
      if (M.isLivestock(f)) v += f.herd * TG.W.price(g, 'beef', 0) * 0.6;
      return Math.round(v);
    },
  };
'''
z=s.index("  // farm actions")
new=open('farm_new.js').read().replace("    WEATHER_PLACEHOLDER\n", weather)
s=s[:a]+new+endSeason+extra+inv+s[z:]
b0=s.index("  M.farmBuyCattle = (g, b, head) => {"); b1=s.index("  // ============ FREIGHT")
s=s[:b0]+open('farm_actions.js').read()+s[b1:]
open('../js/models.js','w').write(s)
print('spliced')
