import json,sys
A,B=sys.argv[1],sys.argv[2]
a=json.load(open(A+'/progress.json'))['reports']; b=json.load(open(B+'/progress.json'))['reports']
n=min(len(a),len(b)); first=next((i for i in range(n) if a[i]['digest']!=b[i]['digest']),None)
print('hours compared',n,'first different hour',None if first is None else a[first]['minute']//60)
keys=['human.down','human.treat','human.medical.payment','human.medical.water','human.medical.respond','human.drink','death','human.death']
def tot(rep,upto): 
    t={}
    for x in rep[:upto]:
        for k,v in x['receipts'].items(): t[k]=t.get(k,0)+v
    return t
ta,tb=tot(a,n),tot(b,n)
for k in keys: print('%-24s %6d %6d'%(k,ta.get(k,0),tb.get(k,0)))
dk=[k for k in set(ta)|set(tb) if 'dead' in k or 'kill' in k or 'die' in k]; print(dk)
print('states at last common hour',a[n-1]['states'],b[n-1]['states'])
