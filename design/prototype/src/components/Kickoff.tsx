import { useEffect, useState } from "react";
import Crest from "./Crest";
import { LeagueCue, LeagueWatermark } from "./LeagueMark";
import { toggleFollow, useIsFollowing } from "./follow";
import { wash } from "./leagues";

/* ============================================================================
   THE NEXT MATCH
   ----------------------------------------------------------------------------
   The page does not end on a footer. It ends on a clock.

   One fixture — the next one to kick off anywhere we cover — its research not
   yet published, and the time until it is. Everything here is anticipation:
   the countdown running, the publish window filling, the two crests waiting.

   The feeling to leave the reader with is not "I should sign up".
   It is "I want to see this match".
   ========================================================================== */

type Side = { id: number; name: string; short: string };

/** The next occurrence of a wall-clock time, today or tomorrow. */
function nextKickoff(hour: number, minute: number) {
  const t = new Date();
  t.setHours(hour, minute, 0, 0);
  if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
  return t;
}

function useCountdown(target: Date) {
  const [left, setLeft] = useState(() => target.getTime() - Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setLeft(target.getTime() - Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const clamped = Math.max(0, left);
  return {
    total: clamped,
    hours: Math.floor(clamped / 3_600_000),
    minutes: Math.floor((clamped % 3_600_000) / 60_000),
    seconds: Math.floor((clamped % 60_000) / 1000),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** One unit of the clock. The digits are fixed-width so nothing ever shifts. */
function Unit({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="tnum display text-[clamp(3rem,9vw,7.5rem)] leading-none">{value}</span>
      <span className="label mt-4 text-ink-3">{label}</span>
    </span>
  );
}

export default function Kickoff({
  home,
  away,
  league,
  kickoff = "20:00",
  venue,
  round,
}: {
  home: Side;
  away: Side;
  league: { id: number; name: string };
  kickoff?: string;
  venue: string;
  round: string;
}) {
  const [h, m] = kickoff.split(":").map(Number);
  const [target] = useState(() => nextKickoff(h, m));
  const { total, hours, minutes, seconds } = useCountdown(target);

  const id = `${home.id}-${away.id}`;
  const following = useIsFollowing(id);

  // Research publishes ninety minutes out; the rule fills as that moment nears.
  const WINDOW = 6 * 3_600_000;
  const PUBLISH = 90 * 60_000;
  const elapsed = Math.min(1, Math.max(0, (WINDOW - total) / (WINDOW - PUBLISH)));
  const published = total <= PUBLISH;

  return (
    <section id="next" className="relative overflow-hidden border-t border-line bg-canvas">
      {/* the competition owns the atmosphere; the clubs only occupy it */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: wash(league.id, 0.05, "62%") }}
      />
      <LeagueWatermark id={league.id} name={league.name} size={420} opacity={0.05} side="right" />

      {/* the two clubs, patient behind the clock, quieter than the competition */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
        <Crest id={home.id} name={home.name} size={560} className="m-breathe-slow absolute -left-[10%] top-[6%] opacity-[0.035]" />
        <Crest id={away.id} name={away.name} size={520} className="m-breathe absolute -right-[8%] bottom-[2%] opacity-[0.035]" />
      </div>

      <div className="relative mx-auto max-w-[1240px] px-5 py-24 lg:px-8 lg:py-36">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="display mt-4 text-[clamp(2.2rem,4.4vw,3.4rem)]">The next match</h2>
          </div>
          <p className="max-w-[34ch] text-[14px] leading-6 text-ink-2">
            Research for this fixture publishes ninety minutes before kickoff. Nobody sees it earlier — including us.
          </p>
        </div>

        {/* the clock */}
        <div className="mt-16 flex flex-wrap items-end justify-center gap-x-8 gap-y-6 sm:gap-x-14">
          <Unit value={pad(hours)} label="Hours" />
          <span className="display pb-14 text-[clamp(2rem,5vw,4rem)] leading-none text-ink-3">:</span>
          <Unit value={pad(minutes)} label="Minutes" />
          <span className="display pb-14 text-[clamp(2rem,5vw,4rem)] leading-none text-ink-3">:</span>
          <Unit value={pad(seconds)} label="Seconds" />
        </div>

        {/* the publish window, filling */}
        <div className="mx-auto mt-16 max-w-[760px]">
          <div className="flex items-baseline justify-between">
            <span className="label text-ink-3">Research window</span>
            <span className="label text-ink-3">
              {published ? "Published" : "Publishes at KO −90′"}
            </span>
          </div>
          <div className="relative mt-3 h-px w-full bg-line">
            <span
              className="m-live absolute left-0 top-0 h-px bg-ink"
              style={{ width: `${elapsed * 100}%` }}
            />
            <span className="absolute right-0 top-[-5px] h-[11px] w-px bg-ink/30" />
            <span
              className="m-live absolute top-[-3px] h-[7px] w-[7px] -translate-x-1/2 rotate-45 bg-accent"
              style={{ left: `${elapsed * 100}%` }}
            />
          </div>
        </div>

        {/* the fixture itself */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
          <div className="flex items-center gap-5">
            <Crest id={home.id} name={home.name} size={72} className="m-breathe" />
            <div>
              <p className="display text-[clamp(1.4rem,2.6vw,2rem)]">{home.name}</p>
              <p className="label mt-1.5 text-ink-3">Home</p>
            </div>
          </div>
          <span className="label text-ink-3">v</span>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="display text-[clamp(1.4rem,2.6vw,2rem)] text-ink-2">{away.name}</p>
              <p className="label mt-1.5 text-ink-3">Away</p>
            </div>
            <Crest id={away.id} name={away.name} size={72} className="m-breathe-slow" />
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <span className="flex items-center gap-2 text-[13px] text-ink-2">
            <LeagueCue id={league.id} />
            <Crest id={league.id} name={league.name} kind="league" size={15} />
            {league.name} · {round}
          </span>
          <span className="label tnum text-ink-3">KO {kickoff} · {venue}</span>

          {/* the reader's own mark on the match */}
          <button
            onClick={() => toggleFollow(id)}
            aria-pressed={following}
            className="group relative flex items-center gap-3 pb-2.5 pt-1 outline-none"
          >
            <span
              className={`block h-2.5 w-2.5 rotate-45 transition-all duration-[var(--dur-expand)] ease-[var(--ease-respond)] ${
                following ? "scale-100 bg-accent" : "scale-75 bg-ink/25 group-hover:bg-ink/50"
              }`}
            />
            <span className="label text-ink">{following ? "Following this match" : "Follow this match"}</span>
            <span className="absolute bottom-0 left-0 h-px w-full bg-line" />
            <span
              className={`absolute bottom-0 left-0 h-px w-full origin-left bg-accent transition-transform duration-[var(--dur-expand)] ease-[var(--ease-settle)] ${
                following ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
              }`}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
