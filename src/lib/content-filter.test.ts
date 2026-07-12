import { describe, expect, it } from "vitest";
import { parseContentFilter } from "./content-filter";

describe("content filters", () => {
  it("parses title and inclusive timestamp boundaries", () => {
    expect(parseContentFilter("http://localhost/api/content?q=Cat&from=100&to=199&page=2&pageSize=10")).toEqual({
      query: "Cat",
      from: 100,
      to: 199,
      page: 2,
      pageSize: 10,
    });
  });

  it("ignores invalid optional values", () => {
    expect(parseContentFilter("http://localhost/api/content?q=%20&from=nope&page=0&pageSize=nope")).toEqual({
      query: undefined,
      from: undefined,
      to: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it("caps the requested page size at twenty", () => {
    expect(parseContentFilter("http://localhost/api/content?page=3&pageSize=200")).toMatchObject({
      page: 3,
      pageSize: 20,
    });
  });
});
