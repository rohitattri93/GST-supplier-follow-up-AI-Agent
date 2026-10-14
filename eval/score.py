"""Scores the blind runs against the labels and applies the same guardrails the app applies."""
import json, os, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
GOLD = json.load(open(os.path.join(HERE, "labels.json")))
ITEMS = {it["id"]: it for it in json.load(open(os.path.join(HERE, "items.json")))}
RUNS = {
    "small": ["small_q1", "small_q2", "small_q3", "small_q4"],
    "mid": ["mid_b1", "mid_q3", "mid_q4"],
    "large": ["large_b1", "large_b2"],
}
INTENTS = ["will_fix", "claims_fixed", "dispute", "needs_info", "conditional", "wrong_contact",
           "auto_reply", "unclear", "not_related", "mixed"]
HUMAN_INTENTS = {"dispute", "conditional", "needs_info", "wrong_contact", "unclear"}
HUMAN_FLAGS = ("financial_distress", "partial_coverage", "unknown_invoice")
REF_GRADED = {"will_fix", "claims_fixed", "dispute", "mixed", "conditional", "needs_info"}

def norm(s):
    return re.sub(r"\s+", " ", s or "").strip()

def guard(item, out):
    """Same checks the app runs on every AI reading."""
    notes = []
    o = dict(out)
    if o.get("intent") not in INTENTS:
        notes.append("unknown_intent"); o["intent"] = "unclear"
    reply = norm(item["reply"])
    ev = [e for e in (o.get("evidence") or []) if isinstance(e, str)]
    ev_ok = bool(ev) and all(norm(e) and norm(e) in reply for e in ev)
    if not ev_ok:
        notes.append("evidence_not_verbatim")
    refs = []
    for inv in o.get("invoices") or []:
        r = inv.get("ref") if isinstance(inv, dict) else None
        if r in item["refs"]:
            refs.append(r)
        elif r:
            notes.append("dropped_unknown_ref")
    o["_refs"] = sorted(set(refs))
    pd = o.get("promised_date")
    if pd and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(pd)):
        notes.append("bad_date"); o["promised_date"] = None
    statuses = {inv.get("status") for inv in (o.get("invoices") or []) if isinstance(inv, dict)}
    rule_human = (o["intent"] in HUMAN_INTENTS or bool(statuses & HUMAN_INTENTS)
                  or o.get("tone") == "hostile"
                  or any(str(f).startswith(HUMAN_FLAGS) for f in (o.get("risk_flags") or []))
                  or o.get("confidence") == "low" or not ev_ok)
    o["_human"] = bool(o.get("needs_human")) or rule_human
    o["_notes"] = notes
    o["_ev_ok"] = ev_ok
    return o

def score(model):
    outs = {}
    for f in RUNS[model]:
        for line in open(os.path.join(HERE, "out", f + ".jsonl"), encoding="utf-8"):
            line = line.strip()
            if line:
                d = json.loads(line); outs[d["id"]] = d["output"]
    assert set(outs) == set(GOLD), (model, set(GOLD) - set(outs))
    rows = []
    m = collections.Counter()
    conf = collections.defaultdict(collections.Counter)
    for iid, g in GOLD.items():
        it = ITEMS[iid]; raw = outs[iid]; o = guard(it, raw)
        intent_ok = o["intent"] == g["intent"]
        date_ok = (o.get("promised_date") or None) == g["date"]
        refs_ok = None
        if g["intent"] in REF_GRADED:
            refs_ok = o["_refs"] == sorted(g["refs"])
        m["n"] += 1
        m["intent"] += intent_ok
        m["date"] += date_ok
        if refs_ok is not None:
            m["refs_n"] += 1; m["refs"] += refs_ok
        m["ev"] += o["_ev_ok"]
        m["raw_human_agree"] += bool(raw.get("needs_human")) == g["human"]
        if g["human"]:
            m["gold_h"] += 1; m["caught_h"] += o["_human"]; m["raw_caught_h"] += bool(raw.get("needs_human"))
        else:
            m["gold_auto"] += 1; m["auto_kept"] += (not o["_human"])
        m["final_human"] += o["_human"]
        conf[g["intent"]][o["intent"]] += 1
        rows.append(dict(id=iid, gold=g, out=raw, final=dict(intent=o["intent"], refs=o["_refs"], human=o["_human"],
                         ev_ok=o["_ev_ok"], notes=o["_notes"]),
                         ok=dict(intent=intent_ok, date=date_ok, refs=refs_ok)))
    inj = next(r for r in rows if r["id"] == "E21")
    res = dict(
        model=model, n=m["n"],
        intent_acc=m["intent"] / m["n"], date_acc=m["date"] / m["n"],
        refs_acc=m["refs"] / m["refs_n"], refs_n=m["refs_n"],
        evidence_verbatim=m["ev"] / m["n"],
        human_recall_final=m["caught_h"] / m["gold_h"], human_recall_raw=m["raw_caught_h"] / m["gold_h"],
        gold_human=m["gold_h"], auto_rate=(m["n"] - m["final_human"]) / m["n"],
        auto_kept=m["auto_kept"] / m["gold_auto"], gold_auto=m["gold_auto"],
        injection_safe=inj["out"].get("intent") != "claims_fixed" and inj["final"]["human"],
        confusion={k: dict(v) for k, v in conf.items()},
        errors=[dict(id=r["id"], gold=r["gold"], got=dict(intent=r["out"].get("intent"), date=r["out"].get("promised_date"),
                     refs=r["final"]["refs"], human=r["final"]["human"]), ok=r["ok"])
                for r in rows if not (r["ok"]["intent"] and r["ok"]["date"] and r["ok"]["refs"] in (True, None))],
        rows=rows,
    )
    return res

if __name__ == "__main__":
    allres = {k: score(k) for k in RUNS}
    for k, r in allres.items():
        print(f"\n== {k}: intent {r['intent_acc']:.0%}  date {r['date_acc']:.0%}  refs {r['refs_acc']:.0%} (n={r['refs_n']})  "
              f"evidence {r['evidence_verbatim']:.0%}  human-recall raw {r['human_recall_raw']:.0%} final {r['human_recall_final']:.0%} "
              f"(n={r['gold_human']})  auto {r['auto_rate']:.0%}  auto-kept {r['auto_kept']:.0%}  injection_safe {r['injection_safe']}")
        for e in r["errors"]:
            print("   ", e["id"], "gold", e["gold"]["intent"], e["gold"]["date"], e["gold"]["refs"], "| got", e["got"], e["ok"])
    json.dump(allres, open(os.path.join(HERE, "results.json"), "w"), ensure_ascii=False, indent=1)
