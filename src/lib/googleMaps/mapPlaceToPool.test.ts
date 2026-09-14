import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  limitGoogleMapsPlaces,
  mapGoogleMapsDatasetItems,
} from "./mapPlaceToPool";

describe("map Google Maps dataset", () => {
  it("maps a business with website contacts and a nested person", () => {
    const places = mapGoogleMapsDatasetItems([
      {
        title: "Kim's Island",
        placeId: "ChIJreV9aqYWdkgROM_boL6YbwA",
        website: "http://kimsislandsi.com/",
        phoneUnformatted: "+17183565168",
        emails: ["hello@kimsislandsi.com"],
        instagrams: ["https://www.instagram.com/kimsisland/"],
        facebooks: ["https://www.facebook.com/kims"],
        categoryName: "Chinese restaurant",
        address: "175 Main St, Staten Island, NY",
        leads: [
          {
            fullName: "Kim Chen",
            jobTitle: "Owner",
            linkedinProfile: "https://www.linkedin.com/in/kim-chen",
            email: "kim@kimsislandsi.com",
          },
        ],
      },
    ]);
    assert.equal(places.length, 1);
    assert.equal(places[0]?.title, "Kim's Island");
    assert.equal(places[0]?.email, "hello@kimsislandsi.com");
    assert.equal(places[0]?.lead?.fullName, "Kim Chen");
    assert.equal(
      places[0]?.lead?.linkedinUrl,
      "https://www.linkedin.com/in/kim-chen/"
    );
  });

  it("maps Compass leadsEnrichment onto the place", () => {
    const places = mapGoogleMapsDatasetItems([
      {
        title: "Happy Eating",
        placeId: "ChIJreV9aqYWdkgROM_boL6YbwA",
        leadsEnrichment: [
          {
            firstName: "Benjamin",
            lastName: "White",
            fullName: "Benjamin White",
            jobTitle: "Sales Manager",
            linkedinProfile:
              "https://www.linkedin.com/in/benjamin-white-2562a3212",
          },
        ],
      },
    ]);
    assert.equal(places[0]?.lead?.fullName, "Benjamin White");
    assert.equal(
      places[0]?.lead?.linkedinUrl,
      "https://www.linkedin.com/in/benjamin-white-2562a3212/"
    );
  });

  it("attaches a following standalone lead row to the previous place", () => {
    const places = mapGoogleMapsDatasetItems([
      {
        title: "Happy Eating",
        placeId: "ChIJreV9aqYWdkgROM_boL6YbwA",
      },
      {
        fullName: "Benjamin White",
        jobTitle: "Sales Manager",
        linkedinProfile: "https://www.linkedin.com/in/benjamin-white-2562a3212",
      },
    ]);
    assert.equal(places.length, 1);
    assert.equal(places[0]?.lead?.fullName, "Benjamin White");
  });

  it("keeps one row when the same place appears in two searches", () => {
    const places = mapGoogleMapsDatasetItems([
      {
        title: "Smile Dental",
        placeId: "ChIJreV9aqYWdkgROM_boL6YbwA",
      },
      {
        title: "Smile Dental",
        placeId: "ChIJreV9aqYWdkgROM_boL6YbwA",
        leadsEnrichment: [
          {
            fullName: "Ada Smile",
            linkedinProfile: "https://www.linkedin.com/in/ada-smile",
          },
        ],
      },
    ]);
    assert.equal(places.length, 1);
    assert.equal(places[0]?.lead?.fullName, "Ada Smile");
  });

  it("caps unique places at the requested total", () => {
    const places = limitGoogleMapsPlaces(
      [
        { ...emptyPlace("A"), placeId: "place-a" },
        { ...emptyPlace("B"), placeId: "place-b" },
        { ...emptyPlace("C"), placeId: "place-c" },
      ],
      2
    );
    assert.equal(places.length, 2);
    assert.equal(places[0]?.title, "A");
    assert.equal(places[1]?.title, "B");
  });
});

function emptyPlace(title: string) {
  return {
    placeId: null as string | null,
    title,
    website: null,
    phone: null,
    email: null,
    address: null,
    category: null,
    instagrams: [] as string[],
    facebooks: [] as string[],
    companyLinkedIns: [] as string[],
    lead: null,
  };
}
