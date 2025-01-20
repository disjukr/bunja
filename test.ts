import { assertEquals } from "jsr:@std/assert";
import { assertSpyCalls, spy } from "jsr:@std/testing/mock";
import { FakeTime } from "jsr:@std/testing/time";

import { createBunjaStore, createScope } from "./bunja.ts";
import { bunja } from "./bunja.ts";

const readNull = () => (null as any);

Deno.test({
  name: "basic",
  fn() {
    using time = new FakeTime();
    const store = createBunjaStore();
    const myBunjaInstance = {};
    const myBunja = bunja([], () => myBunjaInstance);
    const { value, mount } = store.get(myBunja, readNull);
    const cleanup = mount();
    cleanup();
    assertEquals(value, myBunjaInstance);
    time.tick();
  },
});

Deno.test({
  name: "basic effect",
  fn() {
    using time = new FakeTime();
    const store = createBunjaStore();
    const mountSpy = spy();
    const unmountSpy = spy();
    const myBunja = bunja([], () => ({
      [bunja.effect]() {
        mountSpy();
        return unmountSpy;
      },
    }));
    assertSpyCalls(mountSpy, 0);
    const { mount } = store.get(myBunja, readNull);
    assertSpyCalls(mountSpy, 0);
    const cleanup = mount();
    assertSpyCalls(mountSpy, 1);
    assertSpyCalls(unmountSpy, 0);
    cleanup();
    assertSpyCalls(unmountSpy, 0);
    time.tick();
    assertSpyCalls(unmountSpy, 1);
  },
});

Deno.test({
  name: "bunja that depend on other bunja",
  fn() {
    using time = new FakeTime();
    const store = createBunjaStore();
    const [aMountSpy, aUnmountSpy] = [spy(), spy()];
    const [bMountSpy, bUnmountSpy] = [spy(), spy()];
    const aBunjaInstance = {
      [bunja.effect]() {
        aMountSpy();
        return aUnmountSpy;
      },
    };
    const aBunja = bunja([], () => aBunjaInstance);
    const bBunja = bunja([aBunja], (a) => ({
      a,
      [bunja.effect]() {
        bMountSpy();
        return bUnmountSpy;
      },
    }));
    assertSpyCalls(aMountSpy, 0);
    assertSpyCalls(bMountSpy, 0);
    const { value, mount } = store.get(bBunja, readNull);
    assertEquals(value.a, aBunjaInstance);
    assertSpyCalls(aMountSpy, 0);
    assertSpyCalls(bMountSpy, 0);
    const cleanup = mount();
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 1);
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 0);
    cleanup();
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 0);
    time.tick();
    assertSpyCalls(aUnmountSpy, 1);
    assertSpyCalls(bUnmountSpy, 1);
  },
});

Deno.test({
  name: "A mount first, B mount later & A unmount first, B unmount later",
  fn() {
    using time = new FakeTime();
    const store = createBunjaStore();
    const [aMountSpy, aUnmountSpy] = [spy(), spy()];
    const [bMountSpy, bUnmountSpy] = [spy(), spy()];
    const aBunja = bunja([], () => ({
      [bunja.effect]: () => (aMountSpy(), aUnmountSpy),
    }));
    const bBunja = bunja([aBunja], () => ({
      [bunja.effect]: () => (bMountSpy(), bUnmountSpy),
    }));
    const { mount: m1 } = store.get(aBunja, readNull);
    const c1 = m1();
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 0);
    const { mount: m2 } = store.get(bBunja, readNull);
    const c2 = m2();
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 1);
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 0);
    c1();
    time.tick();
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 0);
    c2();
    time.tick();
    assertSpyCalls(aUnmountSpy, 1);
    assertSpyCalls(bUnmountSpy, 1);
  },
});

Deno.test({
  name: "B mount first, A mount later & B unmount first, A unmount later",
  fn() {
    using time = new FakeTime();
    const store = createBunjaStore();
    const [aMountSpy, aUnmountSpy] = [spy(), spy()];
    const [bMountSpy, bUnmountSpy] = [spy(), spy()];
    const aBunja = bunja([], () => ({
      [bunja.effect]: () => (aMountSpy(), aUnmountSpy),
    }));
    const bBunja = bunja([aBunja], () => ({
      [bunja.effect]: () => (bMountSpy(), bUnmountSpy),
    }));
    const { mount: m1 } = store.get(bBunja, readNull);
    const c1 = m1();
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 1);
    const { mount: m2 } = store.get(aBunja, readNull);
    const c2 = m2();
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 1);
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 0);
    c1();
    time.tick();
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 1);
    c2();
    time.tick();
    assertSpyCalls(aUnmountSpy, 1);
    assertSpyCalls(bUnmountSpy, 1);
  },
});

Deno.test({
  name: "injecting values into a scope when calling store.get",
  fn() {
    using time = new FakeTime();
    const store = createBunjaStore();
    const myScope = createScope<string>();
    const myBunja = bunja([myScope], (scopeValue) => ({ scopeValue }));
    const readScope = <T>(): T => "injected value" as T;
    const { value: { scopeValue }, mount } = store.get(myBunja, readScope);
    const cleanup = mount();
    cleanup();
    assertEquals(scopeValue, "injected value");
    time.tick();
  },
});

Deno.test({
  name: "scope value deduplication using hash function",
  fn() {
    using time = new FakeTime();
    const store = createBunjaStore();
    const myScope = createScope<string>(({ length }) => length);
    const myBunja = bunja([myScope], (scopeValue) => ({ scopeValue }));
    const { value: { scopeValue: scopeValue1 }, mount: mount1 } = store.get(
      myBunja,
      <T>() => "foo" as T,
    );
    const cleanup1 = mount1();
    const { value: { scopeValue: scopeValue2 }, mount: mount2 } = store.get(
      myBunja,
      <T>() => "bar" as T,
    );
    const cleanup2 = mount2();
    const { value: { scopeValue: scopeValue3 }, mount: mount3 } = store.get(
      myBunja,
      <T>() => "baaz" as T,
    );
    const cleanup3 = mount3();
    assertEquals(scopeValue1, "foo");
    assertEquals(scopeValue2, "foo");
    assertEquals(scopeValue3, "baaz");
    cleanup1();
    cleanup2();
    cleanup3();
    time.tick();
  },
});
