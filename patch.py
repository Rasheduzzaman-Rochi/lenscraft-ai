import sys

file_path = "backend/app/api/v1/routes/tools.py"
with open(file_path, 'r') as f:
    content = f.read()

old_code = """
    except ValueError:

        raise HTTPException(
            422,
            "Knowledge search input is invalid."
        ) from None
"""
new_code = """
    except ValueError as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            422,
            f"Knowledge search input is invalid. Detail: {e}"
        ) from None
"""
if old_code in content:
    with open(file_path, 'w') as f:
        f.write(content.replace(old_code, new_code))
    print("Patched.")
else:
    print("Not found.")
