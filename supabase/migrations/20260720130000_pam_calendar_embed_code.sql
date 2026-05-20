-- Set Pam's default booking calendar embed on the primary coach account.
update public.coaches c
set calendar_embed_code = '<iframe src="https://link.procoachplatform.com/widget/booking/YBxvoiQH6HcHjHYrOWkU" style="width: 100%;border:none;overflow: hidden;" scrolling="no" id="8gGuCLQODMv5nY2iZQB9_1779293123369"></iframe><br><script src="https://link.procoachplatform.com/js/form_embed.js" type="text/javascript"></script>'
from auth.users u
where c.id = u.id
  and lower(u.email) = 'pam@businesscoachacademy.com';
