import os, glob

for f in glob.glob('alembic/versions/*.py'):
    with open(f, 'r') as file:
        content = file.read()
        
    content = content.replace("sa.text(\\'true\\')", "sa.text('true')")
    content = content.replace("sa.text(\\'false\\')", "sa.text('false')")
    content = content.replace("sa.text(\\'1\\')", "sa.text('true')")
    content = content.replace("sa.text(\\'0\\')", "sa.text('false')")
    
    with open(f, 'w') as file:
        file.write(content)
