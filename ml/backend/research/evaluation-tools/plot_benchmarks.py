"""Export scientific figures from saved predictions; never reruns models."""
import csv
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'storage/benchmarks/results/v1'


def read_csv(name):
    with (OUT/name).open(encoding='utf-8-sig') as f: return list(csv.DictReader(f))


def main():
    import numpy as np
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from sklearn.metrics import roc_curve,roc_auc_score
    plt.rcParams.update({'font.size':11,'axes.spines.top':False,'axes.spines.right':False,
                         'svg.fonttype':'none','savefig.facecolor':'white'})
    c=json.loads((OUT/'classification_metrics.json').read_text())
    r=json.loads((OUT/'recommendation_metrics.json').read_text())
    rows=read_csv('classification_confusion.csv')
    true_labels=list(json.loads((OUT/'protocol.json').read_text())['classification_mapping'].values())
    predicted=[k for k in rows[0] if k!='true_label' and sum(int(row[k]) for row in rows)>0]
    index={row['true_label']:row for row in rows}
    matrix=np.array([[int(index[label][pred]) for pred in predicted] for label in true_labels])
    fig,ax=plt.subplots(figsize=(13,6),layout='constrained')
    im=ax.imshow(matrix,cmap='Purples',vmin=0,vmax=max(1,matrix.max()),aspect='auto')
    ax.set_xticks(range(len(predicted)),predicted,rotation=45,ha='right')
    ax.set_yticks(range(len(true_labels)),true_labels)
    ax.set_xlabel('Predicted app category (only non-empty columns shown; 23 possible choices)')
    ax.set_ylabel('Mapped dataset category')
    ax.set_title(f'Clothing category audit: {c["correct"]}/{c["n"]} correct ({100*c["accuracy"]:.1f}%)')
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            if matrix[i,j]: ax.text(j,i,str(matrix[i,j]),ha='center',va='center',color='white' if matrix[i,j]>matrix.max()/2 else '#241e31',fontsize=9)
    fig.colorbar(im,ax=ax,label='Images',shrink=.8)
    for suffix in ['png','svg']: fig.savefig(OUT/f'classification_confusion.{suffix}',dpi=180)
    plt.close(fig)

    fig,axes=plt.subplots(1,2,figsize=(11,4.6),layout='constrained')
    fit=r['fitb']
    value=100*fit['accuracy'];lo,hi=np.array(fit['accuracy_ci95'])*100
    axes[0].bar(['App CIR adapter','Random expectation'],[value,25],color=['#654581','#bbb5c4'],width=.55)
    axes[0].errorbar([0],[value],yerr=[[value-lo],[hi-value]],fmt='none',ecolor='#241e31',capsize=7)
    axes[0].set_ylim(0,100);axes[0].set_ylabel('Correct first-choice answers (%)')
    axes[0].set_title('Four-choice completion · 500 test questions')
    axes[0].text(0,value+8,f'{value:.1f}%',ha='center');axes[0].text(1,30,'25.0%',ha='center')
    axes[0].text(.5,.92,'95% Wilson interval on measured accuracy',transform=axes[0].transAxes,ha='center',fontsize=9)
    cp_rows=read_csv('compatibility_test_predictions.csv')
    labels=np.array([int(q['label']) for q in cp_rows]);scores=np.array([float(q['score']) for q in cp_rows])
    fpr,tpr,_=roc_curve(labels,scores)
    axes[1].plot(fpr,tpr,color='#654581',lw=2,label=f'Measured AUC = {roc_auc_score(labels,scores):.3f}')
    axes[1].plot([0,1],[0,1],ls='--',color='#999',label='Chance AUC = 0.500')
    axes[1].set(xlim=(0,1),ylim=(0,1),xlabel='False positive rate',ylabel='True positive rate',title='Compatibility · 1,000 balanced test cases')
    axes[1].legend(loc='lower right',frameon=False)
    for suffix in ['png','svg']: fig.savefig(OUT/f'recommendation_results.{suffix}',dpi=180)
    plt.close(fig)
    print('Exported confusion matrix and recommendation figures as PNG and SVG.')


if __name__=='__main__':main()
