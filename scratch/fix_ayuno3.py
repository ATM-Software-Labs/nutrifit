import re
with open('src/components/WidgetAyuno.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("const [notifAyuno, setNotifAyuno] = useState(false)", "")
content = content.replace("setNotifAyuno(localStorage.getItem('nf:notifAyuno') === 'true')", "")

with open('src/components/WidgetAyuno.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
