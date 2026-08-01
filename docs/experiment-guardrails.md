# Experiment guardrails

Critical guardrail breach → recommendation `STOP_FOR_HARM`. Success cannot be declared while a critical guardrail is breached.

Typical guardrails: API failure rate, signed redirect success (inverse failure), page error rate, search no-result rate, evidence view rate (engagement floor).

Operator availability and signed redirects must never be overridden by variants.
