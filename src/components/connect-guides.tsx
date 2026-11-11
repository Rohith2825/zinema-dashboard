"use client";

import { useState } from "react";
import { BrandIcon, type Brand } from "@/components/landing/logos";
import { CopyBox } from "@/components/token-form";

type Guide = {
  id: Brand; name: string; status: "Verified" | "Supported" | "Should work"; where: string;
  steps: React.ReactNode[]; copy?: { label: string; value: string }[]; tryIt: string; note?: string;
};

/** Step-by-step connection guides, one per assistant. */
export function ConnectGuides({ url }: { url: string }) {
  const guides: Guide[] = [
    {
      id: "claude",
      name: "Claude",
      status: "Verified",
      where: "claude.ai, the desktop app and the phone app",
      steps: [
        <>Open <b>Settings → Connectors</b> and choose <b>Add custom connector</b>.</>,
        <>Name it <b>Zinema OS</b> and paste the server address.</>,
        <>Press <b>Connect</b>. A Zinema OS window opens: sign in with your Zinema Google account and press <b>Allow access</b>.</>,
        <>In a chat, open the tools menu and switch <b>Zinema OS</b> on.</>,
      ],
      tryIt: "Who am I in Zinema OS, and what's waiting on me?",
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      status: "Supported",
      where: "chatgpt.com and the desktop app (developer mode)",
      steps: [
        <>Open <b>Settings → Apps &amp; Connectors → Advanced settings</b> and turn on <b>Developer mode</b>.</>,
        <>Back in Apps &amp; Connectors choose <b>Create</b>. Name it <b>Zinema OS</b> and paste the server address as the MCP server URL.</>,
        <>Keep authentication on <b>OAuth</b>, tick the trust box and create it.</>,
        <>Sign in with your Zinema Google account, press <b>Allow access</b>, then pick Zinema OS from the <b>+</b> menu in a chat.</>,
      ],
      tryIt: "Using Zinema OS, list the Tamil songs and their stages.",
      note: "Menu names change between ChatGPT versions. If you can't find a step, write to info@zinema.music.",
    },
    {
      id: "claudecode",
      name: "Claude Code",
      status: "Supported",
      where: "the terminal, VS Code and JetBrains",
      steps: [
        <>Run the command below once, in any folder.</>,
        <>Start Claude Code, type <b>/mcp</b>, choose <b>zinema-os</b> and press <b>Authenticate</b>. Sign in and allow access in the browser window.</>,
        <>No browser on that machine? Create a personal token on this page and use the second command instead.</>,
      ],
      copy: [
        { label: "Add the server", value: `claude mcp add --transport http zinema-os ${url}` },
        { label: "With a personal token", value: `claude mcp add --transport http zinema-os ${url} --header "Authorization: Bearer zos_YOUR_TOKEN"` },
      ],
      tryIt: "Use zinema-os to show me TAM-0005.",
    },
    {
      id: "cursor",
      name: "Cursor",
      status: "Should work",
      where: "Cursor and other editors that read an mcp.json file",
      steps: [
        <>Open <b>Settings → MCP</b> and choose <b>Add new global MCP server</b> (this opens <code>~/.cursor/mcp.json</code>).</>,
        <>Paste the block below and save.</>,
        <>Back in Settings → MCP, press <b>Login</b> next to zinema-os and sign in with your Zinema Google account.</>,
      ],
      copy: [{ label: "mcp.json", value: `{ "mcpServers": { "zinema-os": { "url": "${url}" } } }` }],
      tryIt: "Ask zinema-os what's in my queue.",
    },
    {
      id: "mcp",
      name: "Any other AI",
      status: "Should work",
      where: "anything that supports remote MCP servers",
      steps: [
        <>Add a <b>remote / HTTP</b> MCP server with the address below (transport: Streamable HTTP).</>,
        <>If the app opens a sign-in window, sign in with your Zinema Google account and allow access. Nothing else is needed.</>,
        <>If it can&apos;t, create a <b>personal token</b> on this page and send it as the header <code>Authorization: Bearer zos_…</code></>,
      ],
      copy: [{ label: "Server address", value: url }],
      tryIt: "Call the whoami tool on Zinema OS.",
    },
  ];
  const [active, setActive] = useState<Brand>("claude");
  const g = guides.find((x) => x.id === active)!;
  const tone = { Verified: "bg-emerald-500/15 text-emerald-800", Supported: "bg-sky-500/15 text-sky-800", "Should work": "bg-black/[0.06] text-zinc-600" }[g.status];

  return (
    <div className="min-w-0">
      <div role="tablist" aria-label="Assistants" className="well flex gap-1 overflow-x-auto !rounded-full p-1.5 [scrollbar-width:none]">
        {guides.map((x) => (
          <button
            key={x.id}
            role="tab"
            type="button"
            aria-selected={x.id === active}
            onClick={() => setActive(x.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${x.id === active ? "bg-surface shadow-raise-sm" : "text-muted hover:text-foreground"}`}
          >
            <BrandIcon name={x.id} size={16} />
            {x.name}
          </button>
        ))}
      </div>

      <div key={g.id} role="tabpanel" className="lb-fade mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="tile flex h-12 w-12 items-center justify-center !rounded-2xl"><BrandIcon name={g.id} size={24} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">Connect {g.name}</h3>
            <p className="text-xs text-muted">Works in {g.where}.</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tone}`}>{g.status}</span>
        </div>

        <ol className="mt-5 space-y-3">
          {g.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-black/[0.06] [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px]">
              <span className="tile flex h-7 w-7 shrink-0 items-center justify-center !rounded-full text-xs font-semibold">{i + 1}</span>
              <span className="min-w-0 pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        {g.copy && (
          <div className="mt-5 space-y-3">
            {g.copy.map((c) => (
              <div key={c.label}>
                <p className="label">{c.label}</p>
                <CopyBox value={c.value} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-[#0d0d10] p-4 text-sm text-neutral-300">
          <p className="eyebrow !text-brand-400">Try saying</p>
          <p className="mt-1.5 text-white">“{g.tryIt}”</p>
        </div>
        {g.note && <p className="mt-3 text-xs text-muted">{g.note}</p>}
      </div>
    </div>
  );
}
