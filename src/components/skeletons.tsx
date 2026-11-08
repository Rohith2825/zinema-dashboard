/** Skeleton loaders in the Zinema brand: grey blocks with an orange-tinted shimmer and a tiny equalizer. */

type Cls = { className?: string };

export function Skel({ className = "" }: Cls) {
  return <span aria-hidden="true" className={`skel block ${className}`} />;
}

export function EqLoader({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-xs text-zinc-500">
      <span className="eq-loader" aria-hidden="true"><i /><i /><i /><i /></span>
      {label}…
    </span>
  );
}

function TitleSkel({ label, actions = 0 }: { label: string; actions?: number }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-2">
        <Skel className="h-6 w-40" />
        <EqLoader label={label} />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }, (_, i) => <Skel key={i} className="h-8 w-28" />)}
      </div>
    </div>
  );
}

function TabsSkel() {
  return (
    <div className="mb-4 flex gap-2">
      {[80, 64, 64, 80, 72, 60].map((w, i) => <SkelW key={i} w={w} className="h-7 rounded-full" />)}
    </div>
  );
}

// Width helper without Tailwind arbitrary values per call.
function SkelW({ w, className = "" }: { w: number | string; className?: string }) {
  return <span aria-hidden="true" className={`skel block ${className}`} style={{ width: typeof w === "number" ? `${w}px` : w }} />;
}

export function BoardSkeleton() {
  const cards = [3, 2, 4, 1, 2, 3, 1, 2];
  return (
    <>
      <TitleSkel label="Loading board" actions={1} />
      <TabsSkel />
      <div className="-mx-4 overflow-hidden px-4 md:-mx-8 md:px-8">
        <div className="flex gap-3">
          {cards.map((n, c) => (
            <section key={c} className="w-64 shrink-0 rounded-xl bg-zinc-100/70 p-2">
              <div className="mb-3 flex items-center justify-between px-1 pt-1">
                <SkelW w={72} className="h-3.5" />
                <SkelW w={14} className="h-3.5" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: n }, (_, i) => (
                  <div key={i} className="rounded-lg border border-zinc-200 bg-white p-3">
                    <SkelW w={64} className="h-2.5" />
                    <SkelW w={`${60 + ((c + i) * 13) % 35}%`} className="mt-2 h-4" />
                    <div className="mt-3 flex gap-1">
                      <SkelW w={58} className="h-4" />
                      <SkelW w={40} className="h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

export function CalendarSkeleton() {
  return (
    <>
      <TitleSkel label="Loading calendar" actions={2} />
      <TabsSkel />
      <div className="mb-3 flex items-center gap-2">
        <SkelW w={34} className="h-8" />
        <SkelW w={170} className="h-6" />
        <SkelW w={34} className="h-8" />
      </div>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 px-2 py-2">
          {Array.from({ length: 7 }, (_, i) => <SkelW key={i} w={28} className="h-3" />)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="min-h-24 border-b border-r border-zinc-100 p-1.5">
              <SkelW w={16} className="h-3" />
              {i % 5 === 1 && <SkelW w="85%" className="mt-2 h-4" />}
              {i % 9 === 3 && <SkelW w="70%" className="mt-1 h-4" />}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function TasksSkeleton() {
  return (
    <>
      <TitleSkel label="Loading tasks" actions={1} />
      <TabsSkel />
      <div className="grid gap-3 md:grid-cols-4">
        {[3, 2, 1, 2].map((n, c) => (
          <section key={c} className="rounded-xl bg-zinc-100/70 p-2">
            <SkelW w={60} className="mb-3 ml-1 mt-1 h-3.5" />
            <div className="space-y-2">
              {Array.from({ length: n }, (_, i) => (
                <div key={i} className="rounded-lg border border-zinc-200 bg-white p-3">
                  <SkelW w={`${55 + ((c + i) * 17) % 40}%`} className="h-4" />
                  <div className="mt-2 flex gap-2">
                    <SkelW w={56} className="h-3" />
                    <SkelW w={44} className="h-3" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export function ListSkeleton({ label = "Loading", rows = 6 }: { label?: string; rows?: number }) {
  return (
    <>
      <TitleSkel label={label} actions={1} />
      <div className="card divide-y divide-zinc-100">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <SkelW w={36} className="h-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <SkelW w={`${35 + (i * 19) % 40}%`} className="h-3.5" />
              <SkelW w={`${20 + (i * 11) % 25}%`} className="h-3" />
            </div>
            <SkelW w={64} className="h-5" />
          </div>
        ))}
      </div>
    </>
  );
}

export function TeamSkeleton() {
  return (
    <>
      <TitleSkel label="Loading team" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-3">
                <SkelW w={44} className="h-11 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <SkelW w="55%" className="h-4" />
                  <SkelW w="70%" className="h-3" />
                </div>
              </div>
              <div className="mt-4 flex gap-1.5">
                <SkelW w={88} className="h-6 rounded-full" />
                <SkelW w={72} className="h-6 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="card space-y-3 p-4">
          <SkelW w={150} className="h-5" />
          <SkelW w="100%" className="h-10" />
          <div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }, (_, i) => <SkelW key={i} w="100%" className="h-14" />)}</div>
          <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <SkelW key={i} w="100%" className="h-12" />)}</div>
        </div>
      </div>
    </>
  );
}

export function SongSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <SkelW w={60} className="h-3.5" />
        <div className="mt-3 space-y-2">
          <SkelW w={70} className="h-3" />
          <SkelW w={260} className="h-7" />
          <div className="flex gap-1.5">{[56, 48, 64, 90].map((w, i) => <SkelW key={i} w={w} className="h-5" />)}</div>
        </div>
        <div className="mt-5 flex flex-wrap gap-1">
          {[54, 52, 92, 86, 50, 54, 60, 40].map((w, i) => <SkelW key={i} w={w} className="h-6 rounded-full" />)}
        </div>
        <div className="mt-3"><EqLoader label="Loading song" /></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card flex items-center justify-between px-4 py-4">
              <SkelW w={110} className="h-4" />
              <SkelW w={70} className="h-3" />
            </div>
          ))}
          <div className="card space-y-3 p-4">
            <SkelW w={90} className="h-4" />
            {Array.from({ length: 3 }, (_, i) => <SkelW key={i} w="100%" className="h-10" />)}
          </div>
        </div>
        <div className="space-y-4">
          {[4, 3, 3].map((n, c) => (
            <div key={c} className="card space-y-2.5 p-4">
              <SkelW w={80} className="h-4" />
              {Array.from({ length: n }, (_, i) => <SkelW key={i} w={`${60 + (i * 13) % 35}%`} className="h-3.5" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <>
      <TitleSkel label={label} />
      <div className="card max-w-xl space-y-4 p-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <SkelW w={80} className="h-3" />
            <SkelW w="100%" className="h-9" />
          </div>
        ))}
        <SkelW w={110} className="h-9" />
      </div>
    </>
  );
}

export function SidebarUserSkeleton() {
  return (
    <div className="space-y-1.5">
      <span className="skel skel-dark block h-3.5 w-24" />
      <span className="skel skel-dark block h-3 w-16" />
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <>
      <TitleSkel label="Loading catalog" actions={1} />
      <TabsSkel />
      <div className="mb-5 flex gap-3 border-b border-zinc-200 pb-2">
        {[30, 64, 72, 96].map((w, i) => <SkelW key={i} w={w} className="h-4" />)}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <SkelW w="100%" className="aspect-square rounded-none" />
            <div className="space-y-2 p-3">
              <SkelW w={`${50 + (i * 17) % 40}%`} className="h-4" />
              <SkelW w="40%" className="h-3" />
              <div className="flex gap-1 pt-1">{[0, 1, 2].map((n) => <SkelW key={n} w={20} className="h-5" />)}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
