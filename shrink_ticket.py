import os
with open('frontend/src/components/student/OrderTicket.jsx', 'r') as f:
    js = f.read()

js = js.replace('size={64}', 'size={48}')
js = js.replace('width="18"', 'width="14"')
js = js.replace('height="18"', 'height="14"')
js = js.replace('width="24"', 'width="20"')
js = js.replace('height="24"', 'height="20"')
js = js.replace('paddingBottom: "32px"', 'paddingBottom: "24px"')

with open('frontend/src/components/student/OrderTicket.jsx', 'w') as f:
    f.write(js)
