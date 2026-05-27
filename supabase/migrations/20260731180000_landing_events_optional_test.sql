-- Landing events are logged continuously; test_id is only set when an A/B test is running.
alter table landing_events alter column test_id drop not null;
