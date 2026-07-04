# coffee-shot-pull-tracker

A simple web app for tracking espresso shot pulls — no build step, no dependencies. Just open `index.html` in a browser.

## Features

- **Shot timer** — start/stop timer with tenth-of-a-second precision; stopping the timer automatically fills in the shot time field
- **Shot details** — record the coffee company, beans, grind size, coffee in weight (g), and coffee out weight (g)
- **Brew ratio** — live ratio preview (e.g. `1:2.0`) calculated from the in/out weights
- **Shot history** — saved shots are listed newest-first with all details, and persist in the browser via `localStorage`
- **Manage entries** — delete individual shots or clear the whole history
- Light and dark mode, following your system preference

## Usage

Open `index.html` directly, or serve it locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Start the timer when the shot begins pulling, stop it when done, fill in the rest of the details, and hit **Save Shot**.
