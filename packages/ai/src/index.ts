// @taweed/ai — the ONLY package that talks to an LLM (plan 04 §5). Everything routes
// through one audited, kill-switched gate; the raw provider client is never exported,
// so an LLM call can never skip the audit trail. LLM surfaces are decision-support +
// human-in-the-loop (SFDA carve-out, 02 §6) and never touch the money path.
//
// Public surface = feature functions + their PHI-free input/output types ONLY.
// (Populated as features land; AI-1 adds explainFlag.)
export {};
