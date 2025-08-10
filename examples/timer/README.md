# Bunja Timer Example

This project is a timer application example using the Bunja state management
library.

## Tech Stack

- **Deno** - Modern TypeScript/JavaScript runtime
- **React** - UI library
- **TypeScript** - Static type checking
- **Vite** - Fast development server and build tool
- **Bunja** - State lifetime management library

## Project Structure

```
src/
├── main.tsx          # Application entry point
├── TimerBoard.tsx    # Timer board component (manages multiple timers)
├── Timer.tsx         # Individual timer component
└── state/
    ├── timer.ts      # Timer state logic (Bunja)
    ├── tick.ts       # Tick state logic 
    └── sound.ts      # Sound state logic
```

## Key Features

- **Multiple Timers**: Run multiple independent timers simultaneously
- **Timer Controls**: Start, stop, and reset functionality
- **Real-time Updates**: Precise time display with 10ms resolution
- **State Lifetime Management**: Efficient resource management through Bunja

## Development Setup

### 1. Install Deno

Deno 2 must be installed:

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

Once the development server starts, you can access it at `http://localhost:5173`
in your browser.

## Build and Deploy

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

## Bunja Usage Example

In this example, Bunja manages the state lifetime of each timer:

```typescript
// timer.ts
const timerBunja = bunja(() => {
  // Initialize timer state
  const timer = { elapsed: 0, running: false };

  // Lifetime effect - set up interval when timer starts
  bunja.effect(() => {
    console.log("Timer mounted");
    return () => console.log("Timer unmounted");
  });

  return {
    start: () => {/* start logic */},
    stop: () => {/* stop logic */},
    reset: () => {/* reset logic */},
  };
});

// Timer.tsx
function Timer({ id }: Props) {
  // Separate timer instances through Scope
  const t = useBunja(timerBunja, [TimerScope.bind(id)]);

  // Subscribe to state with React 19's useSyncExternalStore
  const snapshot = useSyncExternalStore(t.subscribe, t.getSnapshot);

  return (
    <div>
      <div>{formatTime(snapshot.elapsed)}</div>
      <button onClick={t.start}>Start</button>
      <button onClick={t.stop}>Stop</button>
      <button onClick={t.reset}>Reset</button>
    </div>
  );
}
```

## Core Concepts

### 1. State Lifetime Management

Each timer is created when a component mounts and automatically cleaned up when
it unmounts.

### 2. Scope-based Dependency Injection

Through `TimerScope.bind(id)`, independent state instances are created for each
timer.

### 3. React 19 Compatibility

Uses `useSyncExternalStore` for perfect compatibility with React 19's
concurrency features.

## Learning Points

Through this example, you can learn:

- State lifetime management using Bunja
- Dependency injection patterns through Scope
- Integration of React 19 with external state management libraries
- Deno 2 + Vite development environment setup
- Type-safe state management using TypeScript

## Learn More

- [Bunja Documentation](../../README.md)
- [Deno Documentation](https://deno.land/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
