## quick make local mirror (in ajax/libs):

### create list:

```
git grep '"source": "git",' -- '*/package.json' | awk '{print $1}' | awk -F':' '{print$1}' | xargs grep target | awk '{print $3}' | awk -F'"' '{print $2}' >> git-auto-update-repo-list
```
### clone all libs (in local mirror dir):

```
for a in `cat git-auto-update-repo-list`; do git clone; done
for a in `ls`; do mv "$a" "$a.git"; done
```

quick update local mirror (in local mirror dir):

```
for a in `ls`; do cd $a && git pull --tags && cd .. ; done
```

## quick transfer libs' target to local mirror (in ajax/libs, sed on freebsd):

```
git grep '"source": "git",' -- '*/package.json' | awk '{print $1}' | awk -F':' '{print$1}' | xargs sed -i "" -E 's/\"target\"\:\ "git:\/\/github.com\/[a-zA-Z0-9_-_]{0,}\//"target"\:\ "\/\/\/mnt\/tmp\/git-auto-update-test\//'
```
