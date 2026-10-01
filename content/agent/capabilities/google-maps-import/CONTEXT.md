---
id: google-maps-import
title: Find businesses on Google Maps
summary: Search Google Maps for local businesses in a place, find the owner, and save them to a new list.
tools: [google_maps_options, start_google_maps_import, check_import]
references: []
modes: [admin, coach]
---

# Find businesses on Google Maps

## What this is
Search Google Maps for a type of business in a place. For each business we save the name, website and phone, and try to find the owner's name and LinkedIn profile. Results land on a new list in the coach's pool. Best for local, owner-run trades and services.

## What you need (ask in this order, one at a time)
1. **Country.** Call `google_maps_options` for the supported countries. Default to the coach's country. Any other country works too (use "OTHER" with the country name).
2. **Where in the country.** US: ask which state (required), then optionally a city. Elsewhere: a town or city, or the whole country.
3. **What to search for.** One to five search terms, in the words a customer would type into Google Maps: "plumbers", "dental practice", "accountants". Offer close variations ("plumber", "plumbing and heating").
4. **How many businesses.** Options from `google_maps_options` (20 up to 1,000). Default 100. Say the rough cost and time it gives you.

Name the list "Maps · <search> · <place>" unless they give a name.

## The process
1. Gather the four answers above. Repeat them back in one line.
2. Call `start_google_maps_import`. It checks the place, works out the cost, and puts a confirmation card in front of them.
3. After it is confirmed, tell them roughly how long it takes. Use `check_import` when they ask. Owner names and LinkedIn profiles fill in after the businesses arrive.

## What NOT to do
- Do not run it without a place. "UK" alone is allowed, but suggest a region for trades.
- Do not put the place inside the search term ("plumbers in Leeds"). The place goes in its own field.
- Only one Google Maps import runs at a time per coach. If one is running, say so and offer to check it.
