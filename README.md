# claude-usage-hud

A Claude Code mod that shows your **5-hour** and **7-day** usage limits and the **context window** as colored bars, right under the prompt input.

```
? for shortcuts
5h ▰▰▰▰▱▱▱▱▱▱▱▱  34%  ↻ 1h12m   7d ▰▱▱▱▱▱▱▱▱▱▱▱  11%  ↻ 1d5h   context ▰▱▱▱▱▱▱▱▱▱▱▱   6%  59.3k/1M
```

- Bars turn green / yellow / red at 50% and 80%.
- `↻` is the time until the window resets; refreshes every minute.
- `▲ fast` appears when you are using a window faster than its time is passing.
- Narrow terminals (< 100 columns) stack the three items vertically.
- 5h / 7d need a Claude Pro or Max subscription and show `–` until the first reply of a session.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-hud --marketplace qiuyue97/claude-usage-hud
```

Answer `y` to add the marketplace, then pick the **user** scope so every session loads it.

From a shell:

```
claude plugin install usage-hud --marketplace qiuyue97/claude-usage-hud
```

Update later with `claude plugin update usage-hud`.
