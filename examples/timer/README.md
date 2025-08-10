# Bunja Timer/Countdown Example

A comprehensive timer and countdown application demonstrating the power of
**Bunja** lifetime management combined with **Jotai** reactive state management.

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

- **[Deno](https://deno.land/)** - Modern TypeScript/JavaScript runtime
- **[React](https://react.dev/)** - UI library with hooks
- **[TypeScript](https://www.typescriptlang.org/)** - Static type checking
- **[Vite](https://vitejs.dev/)** - Fast development server and build tool
- **[Bunja](../../bunja/README.md)** - State lifetime management library
- **[Jotai](https://jotai.org/)** - Reactive state management with atoms

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
    ├── timer.ts          # Timer state logic with derived atoms
    ├── countdown.ts      # Countdown state logic with derived atoms
    ├── item.ts           # Shared item state (titles, editing)
    ├── tick.ts           # Global ticker for time updates
    ├── sound.ts          # Audio feedback system
    └── jotai-store.ts    # Jotai store scope for dependency injection
```

## 🚀 Development Setup

### 1. Install Deno

Deno 2+ is required:

```bash
# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex

# macOS/Linux
curl -fsSL https://deno.land/install.sh | sh
```

### 2. Install Dependencies

```bash
deno install
```

### 3. Start Development Server

```bash
deno task dev
```

Visit `http://localhost:5173` in your browser.

## 🏗 Build and Deploy

### Production Build

```bash
deno task build
```

Built files will be generated in the `dist/` directory.

### Preview

Preview the built application locally:

```bash
deno task preview
```

## 🧠 Architecture Overview

### Bunja + Jotai Integration

This example showcases how **Bunja** can work seamlessly with **Jotai** for a
powerful state management solution:

- **Bunja** manages component lifetimes and dependency injection
- **Jotai** provides reactive state with atoms and derived atoms
- **Scoped instances** ensure each timer/countdown is independent

### Key Components

```typescript
// Scoped timer state with Jotai integration
export const timerBunja = bunja(() => {
  const store = bunja.use(JotaiStoreScope);

  // Reactive state with Jotai atoms
  const timerAtom = atom({ elapsed: 0, running: false });

  // Derived atoms for computed values
  const secondsAtom = atom((get) => {
    const { elapsed } = get(timerAtom);
    return Math.floor(elapsed / 1000).toString().padStart(2, "0");
  });

  // Lifetime management
  bunja.effect(() => () => cleanup());

  return { timerAtom, secondsAtom, start, stop, reset };
});

// Component usage
function Timer({ id }: Props) {
  const { timerAtom, secondsAtom, start, stop } = useBunja(
    timerBunja,
    [ItemScope.bind(id)], // Scoped dependency injection
  );

  const { running } = useAtomValue(timerAtom);
  const seconds = useAtomValue(secondsAtom);

  return (
    <div>
      <div>{seconds}</div>
      {running
        ? <button onClick={stop}>Stop</button>
        : <button onClick={start}>Start</button>}
    </div>
  );
}
```

## 🎯 Core Concepts Demonstrated

### 1. **Scoped Dependency Injection**

Each timer/countdown gets its own isolated state through `ItemScope.bind(id)`.

### 2. **Reactive State Management**

Jotai atoms provide fine-grained reactivity with automatic dependency tracking.

### 3. **Derived Computations**

Time formatting logic is moved to derived atoms for better performance and
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

- **Bunja + Jotai integration** for robust state management
- **Scoped dependency injection** patterns
- **Derived atoms** for computed values
- **React hooks** with external state libraries
- **TypeScript** for type-safe development
- **Modern CSS** techniques and animations
- **Deno 2 + Vite** development workflow

## 🔗 Learn More

- [Bunja Documentation](../../bunja/README.md)
- [Jotai Documentation](https://jotai.org/)
- [Deno Documentation](https://deno.land/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
