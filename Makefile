.PHONY: run push

run:
	python3 -m http.server 8000 --directory site

push:
	git push origin master
	git push server master
