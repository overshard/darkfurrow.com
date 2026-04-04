.PHONY: run push

run:
	uv run flask --app app run --host 0.0.0.0 --port 8000 --debug

push:
	git push origin master
	git push server master
