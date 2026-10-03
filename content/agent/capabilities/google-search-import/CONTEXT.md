---
id: google-search-import
title: Find businesses on Google Search
summary: Search Google (not Maps) for businesses in a place, find a person to contact, and save them to a new list.
tools: [google_search_options, start_google_search_import, check_import]
references: []
modes: [admin, coach]
---

# Find businesses on Google Search

## What this is
Search Google for a type of business in a place. This is web search, not Google Maps. For each business website that ranks we save the name and site, and look up one person (name, email, phone, LinkedIn) the same way Maps does. Directory sites such as Yelp are skipped. Results land on a new list in the coach's pool. Use it when the businesses they want show up in Google, not only on a map.

## What you need (ask in this order, one at a time)
1. **Country.** Call `google_search_options` for the supported countries. Default to the coach's country. Any other country works too (use "OTHER" with the country name).
2. **Where in the country.** US: ask which state (required), then optionally a city. Elsewhere: a town or city, or the whole country.
3. **What to search for.** One to five search terms, in the words a customer would type into Google: "plumbers", "dental practice", "accountants".
4. **How many businesses.** Options from `google_search_options` (20 up to 1,000). Default 100. Say the rough cost and time it gives you.

Name the list "Search · <search> · <place>" unless they give a name.

## The process
1. Gather the four answers above. Repeat them back in one line.
2. Call `start_google_search_import`. It checks the place, works out the cost, and puts a confirmation card in front of them.
3. After it is confirmed, tell them roughly how long it takes. Use `check_import` with kind `google_search` when they ask. People and LinkedIn profiles fill in with the businesses.

## What NOT to do
- Do not use this for a Maps-only search. If they want listings on a map, open `google-maps-import`.
- Do not put the place inside the search term ("plumbers in Leeds"). The place goes in its own field.
- Only one Google Search import runs at a time per coach. If one is running, say so and offer to check it.
