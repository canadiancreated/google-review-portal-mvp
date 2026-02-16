# Google Review Portal MVP Scaffold

This is the minimal scaffold for the MVP using FastAPI.

## Proposed File Structure

```text
google-review-portal-mvp/
|-- app/
|   |-- templates/
|   |   `-- index.html
|   `-- main.py
|-- requirements.txt
`-- README.md
```

## PowerShell Setup

```powershell
# From project root
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open: http://127.0.0.1:8000/

## Font TODO

TODO: To use Greycliff CF, drop your `.woff2` files into `app/static/fonts/` and add `@font-face` rules in `app/static/app.css`.
