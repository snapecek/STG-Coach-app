-- Extend the shared palette without changing existing club colors.
begin;
alter table public.event_type_colors drop constraint event_type_colors_color_check;
alter table public.event_type_colors add constraint event_type_colors_color_check check(color in (
 '#78c3ba','#ff925c','#70b5ff','#92d68b','#bba7ed','#f3a0cb','#f6d17c','#f2979b',
 '#c4e86b','#8adcf4','#969fff','#df8cf1','#ff7f9f','#e9ad66','#43d6c5','#e2e8f0'
));
commit;
