# Bunja Timer/Countdown Example

A comprehensive timer and countdown application demonstrating the power of
**Bunja** lifetime management combined with **Solid** reactive state management.

## ✨ Features

- **Dual Functionality**: Both stopwatch timers and countdown timers
- **Multiple Instances**: Run multiple independent timers/countdowns
  simultaneously
- **Title Management**: Editable titles for each timer with inline editing
- **Sound Feedback**: Audio cues for start, stop, and completion events
- **Alarm Snooze**: Stop countdown alarms by pressing reset
- **Natural Countdown**: Countdown displays show full seconds (3→2→1→0)
- **Responsive Design**: Modern CSS with animations and mobile support
- **Clean Architecture**: Separated business logic and UI components

## 🛠 Tech Stack

- **[Node.js](https://nodejs.org/)** - JavaScript runtime (managed by mise)
- **[Solid](https://www.solidjs.com/)** - UI library with reactive state management
- **[TypeScript](https://www.typescriptlang.org/)** - Static type checking
- **[Vite](https://vitejs.dev/)** - Fast development server and build tool
- **[Bunja](../../bunja/README.md)** - State lifetime management library

## 📁 Project Structure

```
src/
├── main.tsx              # Application entry point
├── App.tsx               # Main app component
├── Timer.tsx             # Stopwatch timer component
├── Countdown.tsx         # Countdown timer component
├── TitleEditor.tsx       # Shared title editing component
├── styles.css            # Modern CSS with animations
└── state/
    ├── app.ts            # Dashboard state (item management)
    ├── timer.ts          # Timer state logic with derived memos
    ├── countdown.ts      # Countdown state logic with derived memos
    ├── item.ts           # Shared item state (titles, editing)
    ├── tick.ts           # Global ticker for time updates
    └── sound.ts          # Audio feedback system
```

## 🚀 Development Setup

### 1. Install the pinned toolchain

From the repository root, install [mise](https://mise.jdx.dev/), then run:

```sh
mise install
pnpm install --frozen-lockfile
pnpm --filter bunja build
```

Node.js 26.13.0 and pnpm 12.16.1 are pinned in `mise.toml`. Run the commands
below from this example directory. Rebuild Bunja after editing library code, or run its
build with `--watch` in another terminal.

### 2. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

### 3. Start Development Server

```bash
pnpm dev
```

Visit `http://localhost:5173` in your browser.

## 🏗 Build and Deploy

### Production Build

```bash
pnpm build
```

Built files will be generated in the `dist/` directory.

### Preview

Preview the built application locally:

```bash
pnpm preview
```

## 🧠 Architecture Overview

### Bunja + Solid Integration

This example showcases how **Bunja** can work seamlessly with **Solid** for a
powerful state management solution:

- **Bunja** manages component lifetimes and dependency injection
- **Solid** provides reactive state with signals and memos
- **Scoped instances** ensure each timer/countdown is independent

### Key Components

```tsx
// Scoped timer state with Solid integration
export const timerBunja = bunja(() => {
  // Reactive state with Solid stores
  const [timer, setTimer] = createStore({ elapsed: 0, running: false });

  // Derived memos for computed values
  const seconds = createMemo(() => {
    return Math.floor(timer.elapsed / 1000).toString().padStart(2, "0");
  });

  // Lifetime management
  bunja.effect(() => () => cleanup());

  return { timer, seconds, start, stop, reset };
});

// Component usage
function Timer(props: Props) {
  const timer = useBunja(
    timerBunja,
    () => [ItemScope.bind(props.id)], // Scoped dependency injection
  );

  return (
    <div>
      <div>{timer().seconds()}</div>
      {timer().timer.running
        ? <button onClick={timer().stop}>Stop</button>
        : <button onClick={timer().start}>Start</button>}
    </div>
  );
}
```

## 🎯 Core Concepts Demonstrated

### 1. **Scoped Dependency Injection**

Each timer/countdown gets its own isolated state through `ItemScope.bind(id)`.

### 2. **Reactive State Management**

Solid signals provide fine-grained reactivity with automatic dependency tracking.

### 3. **Derived Computations**

Time formatting logic is moved to memos for better performance and
separation of concerns.

### 4. **Lifetime Management**

Bunja automatically handles setup/cleanup of intervals and event listeners.

### 5. **Sound System**

Global sound management with alarm functionality and snooze capability.

## 🎨 UI Features

- **Modern Design**: Glass morphism with gradient backgrounds
- **Smooth Animations**: CSS transitions and keyframe animations
- **Status Indicators**: Visual feedback for running/stopped/finished states
- **Responsive Layout**: Works on desktop and mobile devices
- **Accessibility**: Proper semantic HTML and keyboard navigation

## 📚 Learning Points

This example teaches:

- **Bunja + Solid integration** for robust state management
- **Scoped dependency injection** patterns
- **Derived memos** for computed values
- **TypeScript** for type-safe development
- **Modern CSS** techniques and animations
- **Node.js + pnpm + Vite** development workflow

## 🔗 Learn More

- [Bunja Documentation](../../bunja/README.md)
- [Solid Documentation](https://docs.solidjs.com/)
- [mise Documentation](https://mise.jdx.dev/)
- [Vite Documentation](https://vitejs.dev/)
