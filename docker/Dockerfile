FROM python:3.10-slim-bullseye

WORKDIR /mlflow

COPY . .

RUN pip install --upgrade pip
RUN pip install -e '.[extras,db,auth]'
RUN pip install psycopg2-binary
