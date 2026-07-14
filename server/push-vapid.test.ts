import { describe, expect, it } from "vitest";
import { compareApplicationServerKey } from "../shared/push-vapid";

describe("compareApplicationServerKey", () => {
  it("reconhece a mesma chave VAPID", () => {
    const expected = Uint8Array.from([4, 10, 20, 30, 40]);
    const registered = expected.slice().buffer;

    expect(compareApplicationServerKey(registered, expected)).toBe(true);
  });

  it("detecta uma subscription criada por outra chave VAPID", () => {
    const expected = Uint8Array.from([4, 10, 20, 30, 40]);
    const registered = Uint8Array.from([4, 10, 20, 30, 41]).buffer;

    expect(compareApplicationServerKey(registered, expected)).toBe(false);
  });

  it("detecta chaves de tamanhos diferentes", () => {
    const expected = Uint8Array.from([4, 10, 20, 30, 40]);
    const registered = Uint8Array.from([4, 10, 20]).buffer;

    expect(compareApplicationServerKey(registered, expected)).toBe(false);
  });

  it("mantém compatibilidade quando o navegador não expõe a chave", () => {
    expect(compareApplicationServerKey(null, Uint8Array.from([4]))).toBeNull();
  });

  it("respeita byteOffset e byteLength de views", () => {
    const backing = Uint8Array.from([99, 4, 10, 20, 30, 40, 99]);
    const registered = backing.subarray(1, 6);

    expect(
      compareApplicationServerKey(
        registered,
        Uint8Array.from([4, 10, 20, 30, 40]),
      ),
    ).toBe(true);
  });
});
