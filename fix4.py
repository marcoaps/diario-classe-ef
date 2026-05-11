f = "src/ui/pages/ProvasOnline.tsx"
c = open(f, encoding="utf-8").read()
c = c.replace('matchImg = linhaHtml.match(/src="(img_\\\\d+)"/)','matchImg = linhaHtml.match(/src="(img_\\d+)"/)')
open(f, "w", encoding="utf-8").write(c)
# verifica
idx = c.find("matchImg")
print("Resultado:", repr(c[idx:idx+60]))
